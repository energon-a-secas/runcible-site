#!/usr/bin/env node
/**
 * data/sentences/<chapter>.json, sliced out of the Tatoeba exports.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD, and this script is the reason that
 * sentence had to be written down. Tatoeba ships bz2. Browsers do not decode
 * bz2: DecompressionStream handles gzip and deflate only. So the conversion
 * happens here, on a person's machine, once, and the slice is committed:
 *
 *   node tools/build-vocab.mjs      # first: the target words come from it
 *   node tools/build-sentences.mjs
 *
 * Never wire this into CI or `make serve`. It downloads 30 MB and shells out
 * to `bunzip2`.
 *
 * What ships is a few hundred short sentences per chapter, each one containing
 * a word that chapter teaches. `jpn_sentences.tsv.bz2` alone is 3.26 MB and is
 * never shipped (CONTRACTS C11.6).
 *
 * Tatoeba is CC BY 2.0 FR, a different licence from the dictionary's
 * CC BY-SA 4.0, so these files carry the Tatoeba `_licence` block and their own
 * attribution. Every sentence keeps both Tatoeba ids, so any line can be traced
 * back to its contributors.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadBz2Text, SOURCES } from './lib/sources.mjs';
import {
  SITE, licenceBlock, readSelection, writeData, hasBannedDash,
} from './lib/corpus.mjs';

const TOOL = 'tools/build-sentences.mjs';

/** jpn id to the list of eng ids it is linked to, plus every eng id named. */
function readLinks() {
  const byJpn = new Map();
  const wanted = new Set();
  for (const line of loadBz2Text('tatoebaLinks').split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const jpnId = line.slice(0, tab);
    const engId = line.slice(tab + 1).trim();
    if (!engId) continue;
    if (!byJpn.has(jpnId)) byJpn.set(jpnId, []);
    byJpn.get(jpnId).push(engId);
    wanted.add(engId);
  }
  return { byJpn, wanted };
}

/**
 * id to text, keeping only the rows that can end up in a slice. The English
 * export is 24.8 MB compressed and about two million rows; holding all of it
 * would be 50 times the memory for no gain, so only the ids some Japanese
 * sentence links to are kept.
 */
function readSentences(key, keep) {
  const map = new Map();
  for (const line of loadBz2Text(key).split('\n')) {
    const first = line.indexOf('\t');
    if (first < 0) continue;
    const id = line.slice(0, first);
    if (keep && !keep(id)) continue;
    const text = line.slice(line.indexOf('\t', first + 1) + 1).trim();
    if (text) map.set(id, text);
  }
  return map;
}

/**
 * One pass over the corpus, not one pass per word. Short, linked, dash-free
 * pairs, sorted shortest first, so picking sentences for a word is a scan of a
 * few tens of thousands rather than a quarter of a million.
 */
function buildPool(jpn, eng, byJpn, maxChars) {
  const pool = [];
  for (const [jaId, ja] of jpn) {
    if (ja.length > maxChars || hasBannedDash(ja)) continue;
    const partners = byJpn.get(jaId);
    if (!partners) continue;
    for (const enId of partners) {
      const en = eng.get(enId);
      // The house rule reaches JSON string values, and Tatoeba's English half
      // is ordinary prose full of the banned character. Such a pair is skipped,
      // never rewritten: editing somebody's contributed sentence is not ours.
      if (!en || hasBannedDash(en)) continue;
      pool.push({ ja, en, jaId, enId });
      break;
    }
  }
  pool.sort((a, b) => a.ja.length - b.ja.length || Number(a.jaId) - Number(b.jaId));
  return pool;
}

function vocabSlice(file) {
  const abs = path.join(SITE, 'data', 'vocab', file);
  if (!fs.existsSync(abs)) {
    process.stderr.write(`missing ${abs}\nRun node tools/build-vocab.mjs first.\n`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function main() {
  const sel = readSelection('sentences.json');
  const maxChars = Math.max(...sel.slices.map((s) => s.max_chars));

  const { byJpn, wanted } = readLinks();
  const jpn = readSentences('tatoebaJpn', (id) => byJpn.has(id));
  const eng = readSentences('tatoebaEng', (id) => wanted.has(id));
  process.stdout.write(
    `${jpn.size} linked Japanese sentences, ${eng.size} English partners, `
    + `${byJpn.size} link rows\n`);

  const pool = buildPool(jpn, eng, byJpn, maxChars);
  process.stdout.write(`${pool.length} pairs at or under ${maxChars} characters\n`);

  for (const slice of sel.slices) {
    const vocab = vocabSlice(slice.vocab);
    const groups = {};
    const labels = {};
    const order = [];
    const usedJa = new Set();
    let seq = 0;

    for (const groupId of slice.groups) {
      const words = vocab.groups[groupId];
      if (!words) {
        process.stderr.write(`  ${slice.vocab} has no group ${groupId}\n`);
        process.exitCode = 1;
        continue;
      }
      const picked = [];
      for (const item of words) {
        if (picked.length >= slice.max_per_group) break;
        let taken = 0;
        for (const form of [...new Set([item.word, item.kana])]) {
          if (taken >= slice.per_word) break;
          for (const c of pool) {
            if (taken >= slice.per_word || picked.length >= slice.max_per_group) break;
            if (c.ja.length > slice.max_chars) break; // pool is sorted by length
            if (usedJa.has(c.jaId) || !c.ja.includes(form)) continue;
            usedJa.add(c.jaId);
            seq += 1;
            picked.push({
              id: `s_${String(seq).padStart(4, '0')}`,
              ja: c.ja,
              en: c.en,
              for: item.id,
              word: form,
              tatoeba: [Number(c.jaId), Number(c.enId)],
            });
            taken += 1;
          }
        }
      }
      groups[groupId] = picked;
      labels[groupId] = vocab.labels[groupId];
      order.push(groupId);
    }

    const doc = {
      _licence: licenceBlock('tatoeba', TOOL, {
        upstream: `${SOURCES.tatoebaJpn.name}, ${SOURCES.tatoebaJpn.release}`,
      }),
      format: 'neo-sentences/1',
      chapter: slice.chapter,
      title: slice.title,
      order,
      labels,
      count: Object.values(groups).reduce((a, g) => a + g.length, 0),
      groups,
    };
    writeData(path.join(SITE, 'data', 'sentences', slice.file), doc, slice.budget_kb);
  }
}

main();
