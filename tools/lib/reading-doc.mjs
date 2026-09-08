/**
 * One story into one neo-reading/1 document: fetch the archive, decode it,
 * run the safety checks, cut the text up, and write the file.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. See tools/build-reading.mjs.
 *
 * This is where a story is refused. A card that fails a check, or a text whose
 * Shift_JIS decode produced a replacement character, writes nothing and sets a
 * non-zero exit code: a mis-decode is mojibake no licence check can see, so it
 * is treated as a licence failure rather than a formatting one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SITE, writeData } from './corpus.mjs';
import { AOZORA_CACHE, fetchInto, sh, sha256 } from './reading-aozora.mjs';
import { bodyLines, parseRuby, splitSentences } from './reading-text.mjs';
import { checkWork, licenceFor } from './reading-licence.mjs';

// Written as an escape on purpose: a generator that asserts its output carries
// no U+FFFD, spelled with a literal U+FFFD, is the first hit for the grep that
// enforces the rule.
const REPLACEMENT = '\uFFFD';

/** Say why a story was not built, mark the run failed, and hand back nothing. */
export function refuse(card, why) {
  process.stderr.write(`REFUSED card ${card}: ${why}\n`);
  process.exitCode = 1;
  return null;
}

/**
 * A sentence with no word in it: a closing bracket left alone by the splitter.
 * `splitSentences` counts quote depth per paragraph, so a quotation opened in
 * one paragraph and closed two later has its full stop seen at depth 0 and is
 * cut there, leaving the bracket as a "sentence" of its own. Carrying the depth
 * across paragraphs would let one unbalanced opener swallow the rest of a story
 * into a single sentence, so the fragment is joined back onto the sentence
 * before it instead. See `sentences.push` below.
 */
const HAS_WORD = /[\u3041-\u309f\u30a1-\u30ff\u3400-\u9fff\u30fc\u3005]/;

/**
 * A bare speech tag: `と` plus a reporting clause, sitting right after a line
 * of dialogue. Two of them after two lines of the same speaker are the same
 * continuation in everything but the verb the author happened to use, so one is
 * a right answer to the other's question and the round tests recall of a word,
 * not comprehension. The test is structural rather than a list of verbs: the
 * sentence begins with と and the one before it ends in a closing quote. It
 * leaves とうとう alone, which starts with the same character and follows
 * narration rather than speech.
 */
export function isSpeechTag(text, before) {
  return Boolean(before) && /[\u300d\u300f]$/.test(before) && text.startsWith('\u3068');
}

/**
 * Non-overlapping windows of 3 to 6 consecutive sentences, lengths cycling so
 * a re-run produces the same file. `sequence` is an ARRAY of sentences, not a
 * space-joined string: order.js splits a string on whitespace, and three of
 * these four stories separate their words with the full-width space, so a
 * joined string would shatter into single words.
 */
export function chunksOf(sentences) {
  const out = [];
  let i = 0;
  let n = 0;
  while (i < sentences.length) {
    const size = 3 + (n % 4);
    const take = sentences.slice(i, i + size);
    if (take.length < 3) {
      if (out.length) out[out.length - 1].sequence.push(...take.map((s) => s.text));
      break;
    }
    out.push({
      id: `c_${String(out.length + 1).padStart(3, '0')}`,
      from: take[0].id,
      n: take.length,
      sequence: take.map((s) => s.text),
    });
    i += take.length;
    n += 1;
  }
  for (const c of out) c.n = c.sequence.length;
  return out;
}

export function build(sel, index, selection) {
  const cardId = String(sel.card).padStart(6, '0');
  const rows = index.byCard.get(cardId);
  if (!rows) throw new Error(`card ${sel.card} is not in the Aozora index`);
  const work = rows[0];

  const problems = checkWork(sel, rows, selection.filters);
  if (problems.length) return refuse(sel.card, `${work.title}\n  ${problems.join('\n  ')}`);

  const zipName = path.basename(new URL(work.textUrl).pathname);
  const zip = fetchInto(work.textUrl, zipName);
  const out = path.join(AOZORA_CACHE, cardId);
  fs.mkdirSync(out, { recursive: true });
  sh('unzip', ['-o', '-q', zip, '-d', out]);
  const txt = fs.readdirSync(out).find((f) => f.toLowerCase().endsWith('.txt'));
  if (!txt) throw new Error(`card ${sel.card}: the archive holds no .txt member`);
  const bytes = fs.readFileSync(path.join(out, txt));
  const text = new TextDecoder('shift_jis').decode(bytes);
  if (text.includes(REPLACEMENT)) {
    return refuse(sel.card, 'the decoded text carries U+FFFD, so the Shift_JIS decode failed');
  }

  const source = { index: { bytes: index.bytes, sha256: index.sha256 },
    text: { bytes: fs.statSync(zip).size, sha256: sha256(zip) } };

  const paragraphs = [];
  const sentences = [];
  const rubyBy = new Map();
  for (const line of bodyLines(text)) {
    const pid = `p_${String(paragraphs.length + 1).padStart(3, '0')}`;
    const ids = [];
    for (const raw of splitSentences(line)) {
      const { plain, found } = parseRuby(raw);
      const trimmed = plain.trim();
      if (trimmed === '') continue;
      // A fragment with no kana and no kanji in it is not a sentence. It is the
      // closing bracket of a quotation the splitter could not see the opener
      // of, and shipped as a sentence it becomes a one-character token in an
      // order round and a zero-word option in a next-sentence round. Joined
      // back on, the bracket ends up where the story prints it.
      let sid;
      if (!HAS_WORD.test(trimmed) && sentences.length) {
        const prev = sentences[sentences.length - 1];
        prev.text += trimmed;
        sid = prev.id;
      } else {
        sid = `s_${String(sentences.length + 1).padStart(3, '0')}`;
        sentences.push({ id: sid, seq: sentences.length + 1, p: pid, text: trimmed });
      }
      if (!ids.includes(sid)) ids.push(sid);
      for (const r of found) {
        const key = `${r.base} ${r.reading}`;
        if (!rubyBy.has(key)) rubyBy.set(key, { base: r.base, reading: r.reading, n: 0, at: [] });
        const entry = rubyBy.get(key);
        entry.n += 1;
        if (!entry.at.includes(sid)) entry.at.push(sid);
      }
    }
    if (!ids.length) continue;
    paragraphs.push({ id: pid, sentences: ids, text: parseRuby(line).plain.trim() });
  }

  const ruby = [...rubyBy.values()].map((r, i) => ({
    id: `r_${String(i + 1).padStart(3, '0')}`,
    word: r.base,
    reading: r.reading,
    n: r.n,
    at: r.at,
  }));
  const rubyOccurrences = ruby.reduce((a, r) => a + r.n, 0);

  // The pairs are struck in twos and never overlap, so no sentence is both a
  // prompt and an answer. Consecutive pairs put s(i) in the next of one pair
  // and the text of the following one, and the choice round draws its wrong
  // options from every pair's next with the correct answer removed, so the
  // sentence on the learner's screen was one of the four options. Stepping by
  // two costs half the pairs and each story keeps more than the round asks for.
  // A pair whose answer is a bare speech tag is dropped for the reason on
  // isSpeechTag.
  const pairs = [];
  for (let i = 0; i + 1 < sentences.length; i += 2) {
    const text = sentences[i].text;
    const next = sentences[i + 1].text;
    if (isSpeechTag(next, text)) continue;
    pairs.push({ id: `n_${String(pairs.length + 1).padStart(3, '0')}`, text, next });
  }

  const chunks = chunksOf(sentences);
  const chars = sentences.reduce((a, s) => a + s.text.replace(/\s/g, '').length, 0);

  const doc = {
    _licence: licenceFor(sel, rows, work, source),
    format: 'neo-reading/1',
    id: sel.id,
    card: sel.card,
    story: sel.story,
    title: { ja: work.title, kana: work.titleKana, romaji: txt.replace(/\.txt$/i, '') },
    author: rows.map((r) => ({
      ja: `${r.familyName}${r.givenName}`,
      romaji: `${r.familyRomaji} ${r.givenRomaji}`.trim(),
      role: r.role,
      died: r.death,
    })),
    orthography: work.orthography,
    ndc: work.ndc,
    counts: {
      paragraphs: paragraphs.length,
      sentences: sentences.length,
      chunks: chunks.length,
      pairs: pairs.length,
      ruby: ruby.length,
      ruby_occurrences: rubyOccurrences,
      chars,
    },
    paragraphs,
    sentences,
    chunks,
    pairs,
    ruby,
  };

  const written = writeData(path.join(SITE, 'data', 'reading', sel.file), doc, sel.budget_kb);
  process.stdout.write(
    `  card ${sel.card}  ${work.title}  ${work.orthography}  `
    + `died ${rows.map((r) => r.death).join(', ')}  `
    + `ruby ${ruby.length} distinct / ${rubyOccurrences} occurrences  `
    + `sentences ${sentences.length}  chunks ${chunks.length}  pairs ${pairs.length}  `
    + `chars ${chars}  bytes ${written}\n`);
  return doc;
}
