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
      const sid = `s_${String(sentences.length + 1).padStart(3, '0')}`;
      sentences.push({ id: sid, seq: sentences.length + 1, p: pid, text: trimmed });
      ids.push(sid);
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

  const pairs = sentences.slice(0, -1).map((s, i) => ({
    id: `n_${String(i + 1).padStart(3, '0')}`,
    text: s.text,
    next: sentences[i + 1].text,
  }));

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
