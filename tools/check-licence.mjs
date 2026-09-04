#!/usr/bin/env node
/**
 * check-licence.mjs
 *
 * The banned-song gate. DESIGN.md section 6.2 calls the banned-song rule the
 * single highest-consequence rule in this campaign and records that nothing
 * detects it: this file is the detector. CONTRACTS.md C11.4 is the spec.
 *
 * It exits 0, or it exits 1 and names the file and the line. Nothing runs it
 * for you: `make validate` in this project runs it, and running it is part of
 * the definition of done for any change under data/ or books/.
 *
 * Every banned Japanese string below is written as \u escapes and never as a
 * literal. That is deliberate and it is the point: the rule says these strings
 * must not appear anywhere in the repository, including in comments and test
 * fixtures, and a detector that spells them out would be the first violation of
 * its own rule. It also means this file can scan itself and pass, which it
 * does, because tools/ is one of the scanned directories.
 *
 * The five banned items, by romaji and by reason, because the titles cannot be
 * written here:
 *
 *   1. Umi (1941). Lyricist and composer both died 1974, so it is under
 *      copyright in Japan until 2045, and the URAA restored it in the US to
 *      2036. The title is one very common character, so an occurrence is
 *      permitted only inside an allowed context: see ALLOW_SEA below.
 *   2. Haru no Ogawa as sung, meaning the 1942 revision. The 1912 text is
 *      public domain and ships as data/songs/haru-no-ogawa.json. The revision
 *      is detected by its two opening phrases rather than by the title, which
 *      the permitted text shares.
 *   3. Kisha Poppo. Lyricist died 1975, so Japan to 2046, and URAA-restored in
 *      the US. Its 1937 title is banned too: it is the same work.
 *   4. Yuyake Koyake. Lyricist died 1972, so Japan to 2043. US-clear and
 *      Japan-blocked, which is still blocked. Both spellings of the title are
 *      banned. The hiragana that opens Aka Tombo is a different string and is
 *      not matched here.
 *   5. The third verse of Donguri Korokoro. Verses 1 and 2 are public domain
 *      and ship; the third is not. There is no text to grep for, and there
 *      must never be, so it is enforced by the verse count instead.
 *
 * Sources for every verdict: docs/delivery/research/japanese-open-data-and-songs.md
 * sections C, D and E.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/** C11.4: the gate greps these four directories. */
const SCAN_DIRS = ['books', 'data', 'js', 'tools'];
const SKIP_DIRS = new Set(['node_modules', '.git', '_generated', 'vendor-min']);
const BINARY = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.avif', '.svgz',
  '.woff', '.woff2', '.ttf', '.otf', '.pdf', '.zip', '.gz', '.bz2',
  '.mp3', '.mp4', '.wav', '.ogg',
]);

/**
 * The one string an occurrence of the sea character is allowed to sit inside.
 * It is the tail of the title of Ware wa Umi no Ko, which is one of the
 * nineteen songs that ship. Anything else containing that character is a
 * finding, on purpose: the banned title is a single character and cannot be
 * told apart from the common noun by shape alone.
 *
 * Adding to this list is a licence decision. Do it with a comment naming the
 * song or the phrase, or write the word in kana instead.
 */
const ALLOW_SEA = ['\u6d77\u306e\u5b50'];

const BANNED = [
  {
    id: 'umi-1941',
    label: 'the 1941 sea song',
    why: 'copyright in Japan until 2045, URAA-restored in the US until 2036',
    patterns: ['\u6d77'],
    allow: ALLOW_SEA,
    hint: 'if this is the common noun and not the song, write it in kana, or add the surrounding phrase to ALLOW_SEA with a comment',
  },
  {
    id: 'kisha-poppo',
    label: 'the steam-train song, both its 1937 and its 1945 titles',
    why: 'lyricist died 1975, so copyright in Japan until 2046, and URAA-restored in the US',
    patterns: [
      '\u6c7d\u8eca\u30dd\u30c3\u30dd',
      '\u5175\u968a\u3055\u3093\u306e\u6c7d\u8eca',
    ],
    allow: [],
    hint: 'this song cannot appear in this repository in any form',
  },
  {
    id: 'yuyake-koyake',
    label: 'the sunset song, both spellings of its title',
    why: 'lyricist died 1972, so copyright in Japan until 2043',
    patterns: [
      '\u5915\u713c\u3051\u5c0f\u713c\u3051',
      '\u5915\u713c\u5c0f\u713c',
    ],
    allow: [],
    hint: 'this song cannot appear in this repository in any form. The opening of Aka Tombo is a different string and is not matched here.',
  },
  {
    id: 'haru-no-ogawa-1942',
    label: 'the 1942 revision of the spring brook song, by its two incipits',
    why: 'the reviser died 1974, so the revised text is under copyright in Japan until 2045',
    patterns: [
      '\u3055\u3089\u3055\u3089\u3044\u304f\u3088',
      '\u3055\u3044\u3066\u3044\u308b\u306d\u3068',
    ],
    allow: [],
    hint: 'the 1912 text is the only permitted one and it is already in data/songs/haru-no-ogawa.json',
  },
];

/** The opening of the permitted 1912 text, as a positive control. */
const OGAWA_1912 =
  '\u306f\u308b\u306e\u304a\u304c\u308f\u306f \u3055\u3089\u3055\u3089\u306a\u304c\u308b';

/**
 * Nineteen songs ship. Not twenty, not twenty-one.
 *
 * The research verified nineteen of twenty-four candidates as public domain in
 * both Japan and the US. Five failed and are banned above; two more were
 * excluded by the architect, one because its authorship is disputed in court
 * and one because no source for it could be reached. Adding a twentieth means
 * redoing the copyright work for it and amending this list in the same commit,
 * which is exactly the friction this constant exists to create.
 */
const SONGS = [
  'aka-tombo', 'chatsumi', 'donguri-korokoro', 'furusato', 'hamabe-no-uta',
  'haru-ga-kita', 'haru-no-ogawa', 'hotaru-no-hikari', 'kagome-kagome',
  'kojo-no-tsuki', 'momiji', 'nanatsu-no-ko', 'oborozukiyo', 'sakura-sakura',
  'toryanse', 'usagi', 'ware-wa-umi-no-ko', 'yuki', 'zui-zui-zukkorobashi',
];

const findings = [];
let scanned = 0;
let jsonChecked = 0;

function fail(file, line, message) {
  findings.push({ file, line, message });
}

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (!BINARY.has(extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

function indicesOf(hay, needle) {
  const out = [];
  let i = hay.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = hay.indexOf(needle, i + 1);
  }
  return out;
}

/** True when the hit at [at, at+len) sits wholly inside an allowed phrase. */
function covered(text, at, len, allow) {
  for (const phrase of allow) {
    for (const j of indicesOf(text, phrase)) {
      if (j <= at && at + len <= j + phrase.length) return true;
    }
  }
  return false;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++;
  return line;
}

// ---------------------------------------------------------------- rules 1 and 2
// Any banned title, and the two incipits of the 1942 revision, anywhere under
// the four scanned directories.
const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  scanned++;
  const rel = relative(ROOT, file);
  for (const entry of BANNED) {
    for (const pattern of entry.patterns) {
      for (const at of indicesOf(text, pattern)) {
        if (covered(text, at, pattern.length, entry.allow)) continue;
        fail(rel, lineOf(text, at),
          `banned content: ${entry.label} (${entry.why}). ${entry.hint}`);
      }
    }
  }
}

// ---------------------------------------------------------------- rule 3
// Every data/**/*.json carries a _licence block, per C11.2. The required-field
// check is an extension of C11.4 rule 3: an acknowledgement that is missing
// where screen is required is a licence breach that renders correctly, which
// is precisely the failure mode DESIGN.md section 6.2 describes.
const REQUIRED = ['source', 'spdx', 'screen'];
for (const file of walk(join(ROOT, 'data'))) {
  if (extname(file) !== '.json') continue;
  const rel = relative(ROOT, file);
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    fail(rel, 1, `not valid JSON: ${err.message}`);
    continue;
  }
  jsonChecked++;
  const lic = doc._licence;
  if (!lic || typeof lic !== 'object') {
    fail(rel, 1, 'no _licence block. Every file under data/ opens with one, per C11.2.');
    continue;
  }
  for (const key of REQUIRED) {
    if (!lic[key]) fail(rel, 1, `_licence.${key} is missing or empty (C11.2)`);
  }
  if (lic.screen !== 'required' && lic.screen !== 'none') {
    fail(rel, 1, `_licence.screen is ${JSON.stringify(lic.screen)}, expected "required" or "none"`);
  }
  if (lic.screen === 'required' && !lic.acknowledgement) {
    fail(rel, 1,
      '_licence.screen is required but _licence.acknowledgement is empty, so the shell has no text to render (C11.3)');
  }
}

// ---------------------------------------------------------------- rule 4
// A song file with more verses than its verses_permitted field allows. This is
// the only mechanism that can catch the third verse of the acorn song, because
// that verse must never exist here for a grep to find.
const SONG_DIR = join(ROOT, 'data', 'songs');
if (existsSync(SONG_DIR)) {
  const ids = [];
  for (const file of walk(SONG_DIR)) {
    if (extname(file) !== '.json') continue;
    const rel = relative(ROOT, file);
    let doc;
    try {
      doc = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      continue; // rule 3 already reported it
    }
    if (!Array.isArray(doc.verses)) continue; // the catalog, not a song
    ids.push(doc.id);
    const permitted = doc._licence && doc._licence.verses_permitted;
    if (typeof permitted !== 'number') {
      fail(rel, 1, '_licence.verses_permitted is missing (C11.4 rule 4)');
    } else if (doc.verses.length > permitted) {
      fail(rel, 1,
        `carries ${doc.verses.length} verses but _licence.verses_permitted is ${permitted}. ` +
        'Verses beyond the permitted count are not public domain, or were never verified.');
    }
    if (doc.verse_count !== undefined && doc.verse_count !== doc.verses.length) {
      fail(rel, 1, `verse_count is ${doc.verse_count} but the verses array holds ${doc.verses.length}`);
    }
  }

  ids.sort();
  const missing = SONGS.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !SONGS.includes(id));
  for (const id of missing) {
    fail('data/songs/', 1, `song "${id}" is in the verified nineteen but has no file`);
  }
  for (const id of extra) {
    fail('data/songs/', 1,
      `song "${id}" is not one of the verified nineteen. Adding a song means redoing the ` +
      'copyright work for it in both jurisdictions and amending SONGS in this file.');
  }

  const indexPath = join(SONG_DIR, 'index.json');
  if (existsSync(indexPath)) {
    const idx = JSON.parse(readFileSync(indexPath, 'utf8'));
    if (idx.count !== ids.length) {
      fail('data/songs/index.json', 1,
        `count is ${idx.count} but ${ids.length} song files exist`);
    }
    for (const row of idx.songs || []) {
      if (!existsSync(join(ROOT, row.src))) {
        fail('data/songs/index.json', 1, `src does not exist: ${row.src}`);
      }
    }
  }

  // Positive control: the permitted 1912 text is present. A silent swap of the
  // permitted text for the banned revision would otherwise only be caught by
  // the incipit grep, and a partial rewrite could slip between the two.
  const ogawa = join(SONG_DIR, 'haru-no-ogawa.json');
  if (existsSync(ogawa) && !readFileSync(ogawa, 'utf8').includes(OGAWA_1912)) {
    fail('data/songs/haru-no-ogawa.json', 1,
      'the permitted 1912 opening line is not in this file. Only the 1912 text may ship.');
  }
}

// ---------------------------------------------------------------- report
if (findings.length) {
  console.error('');
  for (const f of findings) console.error(`${f.file}:${f.line}: ${f.message}`);
  console.error('');
  console.error(`check-licence: ${findings.length} problem(s) in ${scanned} files.`);
  console.error('Nothing else in this repository checks these rules. Fix them here.');
  process.exit(1);
}

console.log(
  `check-licence: ok. ${scanned} files scanned in ${SCAN_DIRS.join(', ')}, ` +
  `${jsonChecked} data files carry a _licence block, ${SONGS.length} songs verified.`);
