/**
 * Pinned upstream sources for the Runcible corpus, and the download cache.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 * Nothing runs these scripts for you. They are run by hand by a person, the
 * output under data/ is committed, and the site itself loads only static JSON.
 * Do not wire any tools/build-*.mjs into CI, into `make serve`, or into the
 * root `make smoke`. The site must keep working with every upstream here
 * offline, because the site never touches them: it reads the committed output.
 *
 * Two host tools are required, and they are the reason this cannot run in a
 * browser: `unzip` (the release assets are zip archives) and `bunzip2`
 * (Tatoeba ships bz2 and neither node nor DecompressionStream decodes bz2,
 * which handles gzip and deflate only). Both ship with macOS and every Linux
 * this repo is used on.
 *
 * Downloads land in a cache OUTSIDE the repository, so a data step never
 * leaves a 25 MB archive in a site that publishes its own source. Override
 * with RUNCIBLE_CACHE.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CACHE = process.env.RUNCIBLE_CACHE
  || path.join(os.tmpdir(), 'runcible-corpus-cache');

/**
 * Every upstream, pinned to the exact release fetched on 2026-09-04, with the
 * SHA-256 of the bytes that were actually used to generate the committed data.
 * A mismatch is not fatal (upstream re-releases happen) but it is printed, so
 * a silent change of source is impossible.
 */
export const SOURCES = {
  jmdict: {
    name: 'jmdict-simplified jmdict-eng-common',
    release: '3.6.2+20260831182826',
    url: 'https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20260831182826/jmdict-eng-common-3.6.2+20260831182826.json.zip',
    file: 'jmdict-eng-common.json.zip',
    member: 'jmdict-eng-common-3.6.2.json',
    sha256: 'c55c3e84060e2e094801af65867f4e6b0c0a9d86a8d68368881f6ef95ea8d6da',
    bytes: 1440485,
    licence: 'CC-BY-SA-4.0',
  },
  kanjidic: {
    name: 'jmdict-simplified kanjidic2-en',
    release: '3.6.2+20260831182826',
    url: 'https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20260831182826/kanjidic2-en-3.6.2+20260831182826.json.zip',
    file: 'kanjidic2-en.json.zip',
    member: 'kanjidic2-en-3.6.2.json',
    sha256: '854d763f15d116a57ec250b8e8d0b334416e3dde755c4c49f21d65b56917d679',
    bytes: 1253440,
    licence: 'CC-BY-SA-4.0',
  },
  kanjivg: {
    name: 'KanjiVG stroke order SVGs',
    release: 'r20250816',
    url: 'https://github.com/KanjiVG/kanjivg/releases/download/r20250816/kanjivg-20250816-main.zip',
    file: 'kanjivg-main.zip',
    dir: 'kanjivg',
    sha256: '69a2944ec1183086fdee5ba9c1f48bc306b867480a95b2f337f3203bf50689a3',
    bytes: 12589510,
    licence: 'CC-BY-SA-3.0',
  },
  tatoebaJpn: {
    name: 'Tatoeba Japanese sentences',
    release: 'export of 2026-08-29',
    url: 'https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences.tsv.bz2',
    file: 'jpn_sentences.tsv.bz2',
    bz2: true,
    bytes: 3417299,
    licence: 'CC-BY-2.0-FR',
  },
  tatoebaEng: {
    name: 'Tatoeba English sentences',
    release: 'export of 2026-08-29',
    url: 'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
    file: 'eng_sentences.tsv.bz2',
    bz2: true,
    bytes: 24854952,
    licence: 'CC-BY-2.0-FR',
  },
  tatoebaLinks: {
    name: 'Tatoeba Japanese to English sentence links',
    release: 'export of 2026-08-29',
    url: 'https://downloads.tatoeba.org/exports/per_language/jpn/jpn-eng_links.tsv.bz2',
    file: 'jpn-eng_links.tsv.bz2',
    bz2: true,
    bytes: 1454641,
    licence: 'CC-BY-2.0-FR',
  },
  wanakana: {
    name: 'wanakana',
    release: '5.3.1',
    url: 'https://cdn.jsdelivr.net/npm/wanakana@5.3.1/esm/index.js',
    file: 'wanakana-esm-index.js',
    sha256: 'fa9cfd1f841e57094da55ab372d02246277ba2e2fab2c771715dc2824d4e785f',
    bytes: 62612,
    licence: 'MIT',
  },
};

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opts });
}

export function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Download once into the cache. Returns the absolute path of the local copy. */
export function fetchSource(key) {
  const src = SOURCES[key];
  if (!src) throw new Error(`unknown source: ${key}`);
  fs.mkdirSync(CACHE, { recursive: true });
  const dest = path.join(CACHE, src.file);
  if (!fs.existsSync(dest)) {
    process.stderr.write(`fetch ${src.name} ${src.release}\n  ${src.url}\n`);
    sh('curl', ['-sSL', '--fail', '--max-time', '900', '-o', dest, src.url], {
      stdio: 'inherit',
    });
  }
  const got = fs.statSync(dest).size;
  if (src.bytes && got !== src.bytes) {
    process.stderr.write(
      `  note: ${src.file} is ${got} bytes, pinned record says ${src.bytes}. Upstream moved.\n`);
  }
  if (src.sha256) {
    const hash = sha256(dest);
    if (hash !== src.sha256) {
      process.stderr.write(
        `  note: ${src.file} sha256 ${hash}\n        pinned record ${src.sha256}. Upstream moved.\n`);
    }
  }
  return dest;
}

/** Fetch a zipped JSON release asset and parse the single member out of it. */
export function loadZippedJson(key) {
  const src = SOURCES[key];
  const zip = fetchSource(key);
  const out = path.join(CACHE, key);
  const member = path.join(out, src.member);
  if (!fs.existsSync(member)) {
    fs.mkdirSync(out, { recursive: true });
    sh('unzip', ['-o', '-q', zip, '-d', out]);
  }
  return JSON.parse(fs.readFileSync(member, 'utf8'));
}

/** Fetch and extract the KanjiVG archive. Returns the directory of SVGs. */
export function loadKanjiVgDir() {
  const src = SOURCES.kanjivg;
  const zip = fetchSource('kanjivg');
  const out = path.join(CACHE, src.dir);
  const probe = path.join(out, 'kanji', '03042.svg');
  if (!fs.existsSync(probe)) {
    fs.mkdirSync(out, { recursive: true });
    sh('unzip', ['-o', '-q', zip, '-d', out]);
  }
  return path.join(out, 'kanji');
}

/**
 * Fetch a bz2 export and decompress it with the host `bunzip2`.
 * This is the step the research report named: browsers cannot decode bz2, so
 * the conversion happens here, by hand, and the slice is committed.
 */
export function loadBz2Text(key) {
  const src = SOURCES[key];
  const bz2 = fetchSource(key);
  const plain = bz2.replace(/\.bz2$/, '');
  if (!fs.existsSync(plain)) {
    process.stderr.write(`  bunzip2 ${src.file}\n`);
    sh('bunzip2', ['-k', '-f', bz2], { stdio: 'inherit' });
  }
  return fs.readFileSync(plain, 'utf8');
}
