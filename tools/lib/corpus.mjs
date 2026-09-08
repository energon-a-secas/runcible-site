/**
 * Shared helpers for the Runcible corpus data step.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. See tools/lib/sources.mjs.
 *
 * The three things every build-*.mjs needs and must not each invent:
 * the licence blocks (CONTRACTS C11.2, exact wording, do not paraphrase),
 * a writer that measures the file against the C11.6 size budget, and the
 * em dash guard, because upstream English prose is full of them and the
 * house rule covers JSON string values too.
 */
import fs from 'node:fs';
import path from 'node:path';

export const GENERATED_AT = '2026-09-04';

// Written as escapes on purpose. A source file that spells the banned
// character out is itself a hit for scripts/no-em-dash.py, so the guard
// would fail the check it exists to enforce.
export const EM_DASH = '\u2014';
export const EN_DASH = '\u2013';
// U+30FC is the Japanese long vowel mark. It is not a dash and must never be
// touched: rewriting it corrupts every katakana loanword.
export const LONG_VOWEL = 'ー';

/**
 * CONTRACTS C11.2. The `acknowledgement` strings are quoted, not paraphrased.
 * Changing one of them is a licence breach that renders correctly.
 */
export const LICENCES = {
  edrdg: {
    source: 'JMdict / EDICT, Electronic Dictionary Research and Development Group',
    url: 'https://www.edrdg.org/edrdg/licence.html',
    spdx: 'CC-BY-SA-4.0',
    derived: true,
    id: 'edrdg',
    acknowledgement:
      "This site uses the JMdict/EDICT and KANJIDIC dictionary files. These files are the property of the Electronic Dictionary Research and Development Group, and are used in conformance with the Group's licence.",
    links: [
      'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project',
      'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project',
    ],
    screen: 'required',
  },
  kanjivg: {
    source: 'KanjiVG, Ulrich Apel',
    url: 'http://kanjivg.tagaini.net',
    spdx: 'CC-BY-SA-3.0',
    derived: true,
    id: 'kanjivg',
    acknowledgement:
      "Attribution. You must attribute the work by stating your use of KanjiVG in your own copyright header and linking to KanjiVG's website (http://kanjivg.tagaini.net)",
    links: [
      'http://kanjivg.tagaini.net',
      'https://github.com/KanjiVG/kanjivg',
      'https://creativecommons.org/licenses/by-sa/3.0/',
    ],
    screen: 'required',
  },
  tatoeba: {
    source: 'Tatoeba Project',
    url: 'https://tatoeba.org/en/downloads',
    spdx: 'CC-BY-2.0-FR',
    derived: true,
    id: 'tatoeba',
    acknowledgement:
      'Example sentences come from the Tatoeba Project and are used under the Creative Commons Attribution 2.0 France licence.',
    links: [
      'https://tatoeba.org/en/downloads',
      'https://creativecommons.org/licenses/by/2.0/fr/',
    ],
    screen: 'required',
  },
};

/** A full `_licence` header, per C11.2. */
export function licenceBlock(id, generatedBy, extra = {}) {
  const base = LICENCES[id];
  if (!base) throw new Error(`unknown licence id: ${id}`);
  return {
    ...base,
    ...extra,
    generated_by: generatedBy,
    generated_at: GENERATED_AT,
  };
}

/** Every string reachable from `value`, with its dotted path. */
export function* walkStrings(value, at = '$') {
  if (typeof value === 'string') { yield [at, value]; return; }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) yield* walkStrings(value[i], `${at}[${i}]`);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) yield* walkStrings(v, `${at}.${k}`);
  }
}

/** Reject the house rule's banned character anywhere in a document. */
export function findDashes(doc) {
  const hits = [];
  for (const [at, s] of walkStrings(doc)) {
    if (s.includes(EM_DASH)) hits.push({ at, kind: 'em dash', s });
    else if (s.includes(EN_DASH)) hits.push({ at, kind: 'en dash', s });
  }
  return hits;
}

/** True if the text carries a dash the house rule bans. Used to drop records. */
export function hasBannedDash(text) {
  return text.includes(EM_DASH) || text.includes(EN_DASH);
}

/**
 * Readable JSON that still diffs well: one record per line inside an array or
 * a map, the header object expanded. A committed data artifact is reviewed as
 * a diff, so `JSON.stringify(x)` on one 120 KB line is not acceptable, and
 * two-space pretty print costs 40 percent of the size budget for nothing.
 */
export function serialize(doc) {
  const lines = ['{'];
  const keys = Object.keys(doc);
  keys.forEach((key, i) => {
    const v = doc[key];
    const tail = i === keys.length - 1 ? '' : ',';
    if (Array.isArray(v)) {
      if (v.length === 0) { lines.push(`${JSON.stringify(key)}: []${tail}`); return; }
      lines.push(`${JSON.stringify(key)}: [`);
      v.forEach((el, j) => {
        lines.push(JSON.stringify(el) + (j === v.length - 1 ? '' : ','));
      });
      lines.push(`]${tail}`);
      return;
    }
    if (v && typeof v === 'object' && key !== '_licence'
        && Object.values(v).every((x) => x && typeof x === 'object')) {
      const inner = Object.keys(v);
      lines.push(`${JSON.stringify(key)}: {`);
      inner.forEach((k, j) => {
        lines.push(`${JSON.stringify(k)}: ${JSON.stringify(v[k])}${j === inner.length - 1 ? '' : ','}`);
      });
      lines.push(`}${tail}`);
      return;
    }
    lines.push(`${JSON.stringify(key)}: ${JSON.stringify(v, null, 1).replace(/\n\s*/g, ' ')}${tail}`);
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

export function fmtBytes(n) {
  return n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
}

/**
 * Codepoints a caller wants emitted as a \uXXXX escape instead of as
 * themselves. The parsed value is identical, so nothing the browser sees
 * changes: only the bytes on disk do.
 *
 * It exists for one case and should be used for no other. check-licence.mjs
 * bans a single common character outright, because the title of a 1941 song is
 * that one character and no grep can tell the song from the noun. That is the
 * right call for hand-written prose and the wrong shape for a dictionary slice,
 * where the character is a headword the generator did not choose: KANJIDIC puts
 * it in grade 2 and KanjiVG draws its strokes. A generated file that carries it
 * escaped keeps the gate's full force over every hand-written file and over the
 * other four banned items, and loses it only inside output that is mechanically
 * derived from KANJIDIC and KanjiVG, where a song title cannot arrive.
 *
 * The caller passes the character as an escape in its own source too, so that
 * no file in tools/ spells it out either. Whether this stays or becomes an
 * ALLOW_SEA entry in check-licence.mjs is a licence decision for the owner.
 */
function escapeChars(text, chars) {
  let out = text;
  for (const ch of chars) {
    const cp = ch.codePointAt(0).toString(16).padStart(4, '0');
    out = out.split(ch).join(`\\u${cp}`);
  }
  return out;
}

/**
 * Write one data file, then hold it to C11.6: no single JSON file over 150 KB,
 * and a per-file budget the caller states. Exits non-zero rather than emitting
 * an oversized file, because a slice that is too big is a slice that needed
 * splitting and nobody would have noticed at review time.
 *
 * `escape` is the optional list described above. It defaults to empty, so every
 * existing caller emits exactly the bytes it emitted before.
 */
export function writeData(absPath, doc, budgetKb, escape = []) {
  const dashes = findDashes(doc);
  if (dashes.length) {
    process.stderr.write(`REFUSED ${absPath}\n`);
    for (const d of dashes.slice(0, 8)) {
      process.stderr.write(`  ${d.kind} at ${d.at}: ${d.s.slice(0, 90)}\n`);
    }
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const text = escape.length ? escapeChars(serialize(doc), escape) : serialize(doc);
  JSON.parse(text); // never emit something the browser cannot parse
  fs.writeFileSync(absPath, text);
  const bytes = Buffer.byteLength(text);
  const cap = Math.min(budgetKb, 150) * 1024;
  const over = bytes > cap;
  process.stdout.write(
    `${over ? 'OVER  ' : 'wrote '}${fmtBytes(bytes).padStart(9)}  `
    + `(budget ${budgetKb} KB)  ${path.relative(process.cwd(), absPath)}\n`);
  if (over) {
    process.stderr.write('  split the slice. C11.6 caps every JSON file at 150 KB.\n');
    process.exitCode = 1;
  }
  return bytes;
}

export function readSelection(name) {
  const url = new URL(`../selection/${name}`, import.meta.url);
  return JSON.parse(fs.readFileSync(url, 'utf8'));
}

/** Absolute path of the runcible-site project root, from tools/lib/. */
export const SITE = path.resolve(new URL('../..', import.meta.url).pathname);
export const RAPPEL = path.resolve(SITE, '..', 'rappel-site');
