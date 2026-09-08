#!/usr/bin/env node
/**
 * data/reading/<story>.json, sliced out of Aozora Bunko's own text archives.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 *
 *   node tools/build-reading.mjs
 *
 * Never wire it into CI or `make serve`. It downloads a 2.1 MB index and one
 * small zip per story, and it shells out to `unzip`.
 *
 * Aozora's reuse terms for copyright-expired works permit free copying,
 * redistribution and format conversion (aozora.gr.jp/guide/kijyunn.html), and
 * the bibliography CSV this script filters on is CC BY 4.0. Nothing here is
 * fetched from a source with no licence grant.
 *
 * The selection file pins card ids and nothing else. Every safety judgment is
 * re-derived from the index on each run rather than trusted from the
 * selection, so a story cannot drift into the corpus on a stale note:
 *
 *   1. orthography must be the modern one. Aozora publishes several of these
 *      stories twice, once in the 1940s spelling, and teaching a beginner an
 *      orthography abandoned in 1946 is the trap the research named.
 *   2. the work copyright flag must be the expired one.
 *   3. every contributor on the card, translators included, must have died in
 *      1945 or earlier. That is what makes the work public domain in the US as
 *      well as in Japan: it was already out of copyright at home on the 1996
 *      URAA date, so nothing was restored.
 *   4. the decoded text must carry no U+FFFD. Aozora ships Shift_JIS only, and
 *      a mis-decode is mojibake no licence check can see.
 *
 * Output per story: the passage split into sentences, `chunks[]` for an order
 * drill, `pairs[]` for a next-sentence choice, and `ruby[]` for a typed
 * reading drill, every one derived from the file. Not one string of language
 * in the output was written by a person.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CACHE } from './lib/sources.mjs';
import { SITE, readSelection, writeData } from './lib/corpus.mjs';

const TOOL = 'tools/build-reading.mjs';
const GENERATED_AT = '2026-09-08';
const AOZORA_CACHE = path.join(CACHE, 'aozora');

// Both written as escapes on purpose. A generator that asserts its output
// carries no U+FFFD, spelled with a literal U+FFFD, is the first hit for the
// grep that enforces the rule. The byte-order mark is invisible in an editor,
// which is the other half of the same argument.
const REPLACEMENT = '\uFFFD';
const BOM = '\uFEFF';

const INDEX = {
  name: 'Aozora Bunko bibliography, all works by contributor, extended, UTF-8',
  url: 'https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip',
  file: 'list_person_all_extended_utf8.zip',
  member: 'list_person_all_extended_utf8.csv',
};

/** The index columns this script reads, by the name the CSV header gives them. */
const COL = {
  id: '作品ID', title: '作品名', titleKana: '作品名読み', ndc: '分類番号',
  orthography: '文字遣い種別', copyright: '作品著作権フラグ', card: '図書カードURL',
  familyName: '姓', givenName: '名', familyRomaji: '姓ローマ字', givenRomaji: '名ローマ字',
  role: '役割フラグ', death: '没年月日', personCopyright: '人物著作権フラグ',
  textUrl: 'テキストファイルURL', textEncoding: 'テキストファイル符号化方式',
  edition: '底本名1', editionPublisher: '底本出版社名1', editionYear: '底本初版発行年1',
};

function sh(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] });
}

/** Say why a story was not built, mark the run failed, and hand back nothing. */
function refuse(card, why) {
  process.stderr.write(`REFUSED card ${card}: ${why}\n`);
  process.exitCode = 1;
  return null;
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Download once into the cache outside the repository. */
function fetchInto(url, name) {
  fs.mkdirSync(AOZORA_CACHE, { recursive: true });
  const dest = path.join(AOZORA_CACHE, name);
  if (!fs.existsSync(dest)) {
    process.stderr.write(`fetch ${url}\n`);
    sh('curl', ['-sSL', '--fail', '--max-time', '600', '-o', dest, url]);
  }
  return dest;
}

/** RFC 4180, because the index quotes fields that contain commas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') { field += c; continue; }
      if (text[i + 1] === '"') { field += '"'; i += 1; continue; }
      quoted = false;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; continue; }
    field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function loadIndex() {
  const zip = fetchInto(INDEX.url, INDEX.file);
  const member = path.join(AOZORA_CACHE, INDEX.member);
  if (!fs.existsSync(member)) sh('unzip', ['-o', '-q', zip, '-d', AOZORA_CACHE]);
  const rows = parseCsv(fs.readFileSync(member, 'utf8'));
  const head = rows[0].map((h) => (h.startsWith(BOM) ? h.slice(1) : h));
  const at = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const key of Object.values(COL)) {
    if (at[key] === undefined) throw new Error(`the index has no column ${key}`);
  }
  const byCard = new Map();
  for (const row of rows.slice(1)) {
    const id = row[at[COL.id]];
    if (!id) continue;
    if (!byCard.has(id)) byCard.set(id, []);
    byCard.get(id).push(Object.fromEntries(
      Object.entries(COL).map(([k, col]) => [k, row[at[col]]])));
  }
  return {
    byCard,
    works: byCard.size,
    rows: rows.length - 1,
    bytes: fs.statSync(zip).size,
    sha256: sha256(zip),
  };
}

// ─────────────────────────────────────────────── the Aozora text file format

const RULE = /^-{20,}$/;
const INDENT_OPEN = /^［＃ここから.*字下げ］$/;
const INDENT_CLOSE = /^［＃ここで字下げ終わり］$/;
const NOTE = /［＃[^］]*］/g;
const FOOTER = /^底本[：:]/;

/**
 * Header, footer and editorial notes out; the body's own lines back.
 *
 * The lines of an indented block are joined into one unit with the full-width
 * space, which is the separator these files already use between words. Left
 * as separate lines, a four-line chant becomes four one-word sentences and an
 * order drill fills up with them.
 */
function bodyLines(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  i += 1; // the title
  while (i < lines.length && lines[i].trim() !== '') i += 1; // the author block
  if (lines.slice(i, i + 6).some((l) => RULE.test(l.trim()))) {
    while (i < lines.length && !RULE.test(lines[i].trim())) i += 1;
    i += 1;
    while (i < lines.length && !RULE.test(lines[i].trim())) i += 1;
    i += 1;
  }
  const out = [];
  let block = null;
  for (; i < lines.length; i += 1) {
    const raw = lines[i];
    if (FOOTER.test(raw)) break;
    if (INDENT_OPEN.test(raw.trim())) { block = []; continue; }
    if (INDENT_CLOSE.test(raw.trim())) {
      if (block && block.length) out.push(block.join('　'));
      block = null;
      continue;
    }
    const line = raw.replace(NOTE, '').trim();
    if (line === '') continue;
    if (block) block.push(line);
    else out.push(line.replace(/^　/, ''));
  }
  if (block && block.length) out.push(block.join('　'));
  return out;
}

const OPENERS = new Set(['「', '『', '（', '〔', '【']);
const CLOSERS = new Set(['」', '』', '）', '〕', '】']);
const ENDERS = new Set(['。', '！', '？']);

/**
 * One paragraph into sentences. A full stop inside a quotation does not end a
 * sentence; the closing bracket after it does. Splitting on the stop alone
 * cuts every line of dialogue in these stories in half.
 */
function splitSentences(paragraph) {
  const out = [];
  let cur = '';
  let depth = 0;
  let ended = false;
  for (const ch of paragraph) {
    cur += ch;
    if (OPENERS.has(ch)) { depth += 1; ended = false; continue; }
    if (CLOSERS.has(ch)) {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && ended) { out.push(cur); cur = ''; ended = false; }
      continue;
    }
    if (ENDERS.has(ch)) {
      if (depth === 0) { out.push(cur); cur = ''; ended = false; } else ended = true;
      continue;
    }
    ended = false;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

const IDEOGRAPH = /[々〇一-鿿ヶヵ]/;

function trailingBase(plain) {
  let i = plain.length;
  while (i > 0 && IDEOGRAPH.test(plain[i - 1])) i -= 1;
  return plain.slice(i);
}

/**
 * Aozora's plain text writes furigana as base《reading》, with the vertical
 * bar marking where the base begins when the run before it is ambiguous. The
 * XHTML carries the same information as native ruby elements; this is the
 * same data without an HTML parse.
 */
function parseRuby(text) {
  let plain = '';
  let bar = null;
  const found = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '｜') { bar = plain.length; i += 1; continue; }
    if (ch === '《') {
      const close = text.indexOf('》', i);
      if (close < 0) { plain += ch; i += 1; continue; }
      const reading = text.slice(i + 1, close);
      const base = bar === null ? trailingBase(plain) : plain.slice(bar);
      if (base && reading) found.push({ base, reading });
      bar = null;
      i = close + 1;
      continue;
    }
    plain += ch;
    i += 1;
  }
  return { plain, found };
}

// ───────────────────────────────────────────────────────── the safety checks

function deathYear(value) {
  const m = String(value || '').match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

function checkWork(sel, rows, filters) {
  const problems = [];
  const work = rows[0];
  if (work.orthography !== filters.orthography) {
    problems.push(`orthography is ${work.orthography || 'absent'}, the selection admits only ${filters.orthography}`);
  }
  if (work.copyright !== filters.copyright_flag) {
    problems.push(`work copyright flag is ${work.copyright || 'absent'}, the selection admits only ${filters.copyright_flag}`);
  }
  for (const row of rows) {
    const year = deathYear(row.death);
    const who = `${row.familyName}${row.givenName} (${row.role || 'no role'})`;
    if (year === null) problems.push(`${who} has no death date on the card, so the US test cannot be applied`);
    else if (year > filters.death_year_at_or_before) {
      problems.push(`${who} died ${year}, after ${filters.death_year_at_or_before}`);
    }
  }
  if (sel.title && work.title !== sel.title) {
    problems.push(`the card is titled ${work.title}, the selection says ${sel.title}`);
  }
  return problems;
}

function licenceFor(sel, rows, work, source) {
  const people = rows.map((r) => `${r.familyName}${r.givenName} d.${deathYear(r.death)}`);
  return {
    source: `Aozora Bunko card ${sel.card}, ${work.title}`,
    url: work.card,
    spdx: 'public-domain',
    derived: true,
    id: null,
    acknowledgement: null,
    links: [work.card, work.textUrl, 'https://www.aozora.gr.jp/guide/kijyunn.html'],
    screen: 'none',
    card: sel.card,
    japan: {
      pd: true,
      basis: `${people.join(', ')}, and Aozora's own work copyright flag on the card reads expired`,
      test: 'Japan: every contributor died 1967 or earlier, or the work is anonymous and published 1967 or earlier. Aozora publishes its own determination per card and this file carries it.',
      confidence: 'high',
    },
    us: {
      pd: true,
      basis: `every contributor died 1945 or earlier (${people.join(', ')}), so the work was already out of copyright in Japan on 1996-01-01 and the URAA restored nothing`,
      test: 'US: published 1930 or earlier, or published later with every author dead in 1945 or earlier, because the URAA restored anything still protected in its source country on 1996-01-01.',
      confidence: 'high',
      note: "The Japanese verdict is Aozora's. The US verdict is this repository's computation from the contributor death dates in Aozora's own index, per docs/delivery/research/japanese-chapters-9-12-and-piano.md section A8.",
    },
    source_edition: {
      name: work.edition,
      publisher: work.editionPublisher,
      first_printing: work.editionYear,
      note: 'Aozora asks, and does not require, that its metadata block travel with a copy. It is kept here rather than dropped.',
    },
    upstream: {
      index: `${INDEX.name}, ${source.index.bytes} bytes, sha256 ${source.index.sha256}`,
      text: `${work.textUrl}, ${source.text.bytes} bytes, sha256 ${source.text.sha256}, ${work.textEncoding}`,
      fetched: GENERATED_AT,
    },
    read_by: sel.read_by,
    generated_by: TOOL,
    generated_at: GENERATED_AT,
  };
}

// ────────────────────────────────────────────────────────────── the document

/**
 * Non-overlapping windows of 3 to 6 consecutive sentences, lengths cycling so
 * a re-run produces the same file. `sequence` is an ARRAY of sentences, not a
 * space-joined string: order.js splits a string on whitespace, and three of
 * these four stories separate their words with the full-width space, so a
 * joined string would shatter into single words.
 */
function chunksOf(sentences) {
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

function build(sel, index, selection) {
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

function main() {
  const selection = readSelection('reading.json');
  const index = loadIndex();
  process.stdout.write(
    `Aozora index: ${index.rows} contributor rows, ${index.works} works, `
    + `${index.bytes} bytes, sha256 ${index.sha256}\n`);

  let built = 0;
  for (const sel of selection.stories) {
    if (!sel.build) {
      process.stdout.write(`  card ${sel.card}  held, not built: ${sel.hold}\n`);
      continue;
    }
    if (!sel.read_by) { refuse(sel.card, 'no read_by record, so nobody has read this story'); continue; }
    if (build(sel, index, selection)) built += 1;
  }
  process.stdout.write(`${built} stories written to data/reading/\n`);
}

main();
