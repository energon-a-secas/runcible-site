#!/usr/bin/env node
/**
 * data/kanji/kanjidic-<set>.json, sliced out of kanjidic2-en.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 * Run it by hand, commit the output, never wire it into CI or `make serve`:
 *
 *   node tools/build-kanji.mjs
 *
 * The full dump is 1.2 MB compressed and 14.8 MB parsed and is never shipped
 * (CONTRACTS C11.6). Each set is one teaching unit: the number kanji, the day
 * and time kanji, and the eighty grade 1 kanji ordered by KANJIDIC frequency.
 *
 * KANJIDIC2 is EDRDG, CC BY-SA 4.0, and the acknowledgement is required on
 * every screen that shows one of these characters. That obligation travels in
 * the `_licence` block, not in a comment.
 *
 * Layout note for whoever reads these files: the characters sit at the top
 * level of the document, beside `_licence`, so that CONTRACTS C3.2's bare-key
 * data pointer (`kanjidic-grade1.json#一`) resolves with the same fifteen-line
 * resolver as `strokes.json#あ`. Meta keys all start with an underscore or are
 * ASCII, so a kanji key can never collide with one.
 */
import path from 'node:path';
import { SOURCES } from './lib/sources.mjs';
import {
  SITE, licenceBlock, writeData, hasBannedDash,
} from './lib/corpus.mjs';
import { kanjidic, kanjiSelection, resolveSet } from './lib/kanjisets.mjs';

const TOOL = 'tools/build-kanji.mjs';
const MAX_MEANINGS = 4;
const MAX_READINGS = 4;

function readingsOfType(character, type) {
  const out = [];
  for (const group of character.readingMeaning?.groups || []) {
    for (const r of group.readings) if (r.type === type) out.push(r.value);
  }
  return [...new Set(out)].slice(0, MAX_READINGS);
}

function meaningsOf(character) {
  const out = [];
  for (const group of character.readingMeaning?.groups || []) {
    for (const m of group.meanings) if (m.lang === 'en') out.push(m.value);
  }
  return [...new Set(out)].filter((m) => !hasBannedDash(m)).slice(0, MAX_MEANINGS);
}

function toEntry(character) {
  const entry = {
    literal: character.literal,
    strokes: character.misc.strokeCounts[0],
    on: readingsOfType(character, 'ja_on'),
    kun: readingsOfType(character, 'ja_kun'),
    meanings: meaningsOf(character),
  };
  if (character.misc.grade != null) entry.grade = character.misc.grade;
  if (character.misc.frequency != null) entry.freq = character.misc.frequency;
  if (character.misc.jlptLevel != null) entry.jlpt = character.misc.jlptLevel;
  const classical = character.radicals.find((r) => r.type === 'classical');
  if (classical) entry.radical = classical.value;
  return entry;
}

function main() {
  const dict = kanjidic();
  const byLiteral = new Map(dict.characters.map((c) => [c.literal, c]));
  const sel = kanjiSelection();
  const missing = [];
  let total = 0;

  for (const set of sel.sets) {
    const literals = resolveSet(set);
    const doc = {
      _licence: licenceBlock('edrdg', TOOL, {
        upstream: `${SOURCES.kanjidic.name} ${SOURCES.kanjidic.release}`,
      }),
      format: 'neo-kanji/1',
      set: set.id,
      chapter: set.chapter,
      title: set.title,
      order: literals,
      count: literals.length,
    };
    for (const lit of literals) {
      const character = byLiteral.get(lit);
      if (!character) { missing.push(`${set.id} ${lit}`); continue; }
      doc[lit] = toEntry(character);
    }
    total += literals.length;
    writeData(path.join(SITE, 'data', 'kanji', `kanjidic-${set.id}.json`), doc, set.budget_kb);
  }

  if (missing.length) {
    process.stderr.write(`\n${missing.length} characters are not in KANJIDIC2:\n`);
    for (const m of missing) process.stderr.write(`  ${m}\n`);
    process.exitCode = 1;
  }
  process.stdout.write(`${total} kanji from ${SOURCES.kanjidic.name} ${SOURCES.kanjidic.release}\n`);
}

main();
