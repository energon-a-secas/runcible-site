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
 *
 * That layout is why each file also carries a `list[]`, the same one
 * tools/build-strokes.mjs emits for the same reason. A record is keyed by its
 * character, so an exercise that wants "every character in this set" has no
 * fragment to point at: the whole document resolves to its own meta keys as
 * well, and `_licence` becomes a drill item with a blank prompt. The list is
 * the projection a stroke drill needs, derived in one loop from the map beside
 * it, so the two cannot disagree.
 */
import path from 'node:path';
import { SOURCES } from './lib/sources.mjs';
import {
  SITE, licenceBlock, writeData, hasBannedDash,
} from './lib/corpus.mjs';
import { kanjidic, kanjiSelection, resolveSet, unslicedSet } from './lib/kanjisets.mjs';

const TOOL = 'tools/build-kanji.mjs';
const MAX_MEANINGS = 4;
const MAX_READINGS = 4;

/**
 * One character is emitted as a \uXXXX escape rather than as itself, and the
 * reason is in tools/lib/corpus.mjs beside `escapeChars`: check-licence.mjs
 * bans it outright because a 1941 song's whole title is that single character,
 * and KANJIDIC puts the same character in grade 2. It is written here as an
 * escape too, so this file does not spell it out either.
 */
const ESCAPE = ['\u6d77'];

function readingsOfType(character, type) {
  const out = [];
  for (const group of character.readingMeaning?.groups || []) {
    for (const r of group.readings) if (r.type === type) out.push(r.value);
  }
  return [...new Set(out)].slice(0, MAX_READINGS);
}

/**
 * The five words the fleet's house style bans, as whole words.
 *
 * A gloss is learner-facing English on the page, so the rule reaches it, and
 * this is the same move the line below already makes for the house dash rule:
 * drop the one upstream meaning that breaks a house rule and keep the rest,
 * rather than rewriting a dictionary. KANJIDIC gives most characters more
 * meanings than MAX_MEANINGS ships, so dropping one costs nothing: today it
 * fires on exactly one character of the 269, which keeps four other meanings.
 * A character whose every meaning were dropped would ship with none, and
 * validate-corpus fails that, so the loss can never be silent.
 */
const BANNED_WORDS = /\b(powerful|seamless|leverages|robust|utilize)\b/i;

function meaningsOf(character) {
  const out = [];
  for (const group of character.readingMeaning?.groups || []) {
    for (const m of group.meanings) if (m.lang === 'en') out.push(m.value);
  }
  return [...new Set(out)]
    .filter((m) => !hasBannedDash(m) && !BANNED_WORDS.test(m))
    .slice(0, MAX_MEANINGS);
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

/**
 * Two sets that slice one grade must cover it exactly and may not overlap.
 *
 * resolveSet checks that a slice sits inside its grade. It cannot check that
 * the slices of one grade partition it, because it sees one row at a time, and
 * a gap between two slices is the failure with no symptom: both files are the
 * length their row asked for, both validate, and the characters in the gap are
 * simply never taught. So the sum is asserted here and printed either way.
 */
function checkSlices(sel) {
  const byGrade = new Map();
  for (const set of sel.sets) {
    if (set.slice === undefined) continue;
    if (set.grade == null) {
      process.stderr.write(`set ${set.id} carries a slice but no grade\n`);
      process.exitCode = 1;
      continue;
    }
    if (!byGrade.has(set.grade)) byGrade.set(set.grade, []);
    byGrade.get(set.grade).push(set);
  }
  for (const [grade, sets] of [...byGrade].sort((a, b) => a[0] - b[0])) {
    const whole = unslicedSet(sets[0]);
    const seen = new Map();
    const parts = [];
    for (const set of sets) {
      const literals = resolveSet(set);
      parts.push(`${set.id} ${literals.length}`);
      for (const lit of literals) {
        if (seen.has(lit)) {
          process.stderr.write(`grade ${grade}: ${lit} is in both ${seen.get(lit)} and ${set.id}\n`);
          process.exitCode = 1;
        }
        seen.set(lit, set.id);
      }
    }
    const missing = whole.filter((lit) => !seen.has(lit));
    process.stdout.write(
      `grade ${grade}: ${parts.join(' + ')} = ${seen.size} of ${whole.length}\n`);
    if (missing.length) {
      process.stderr.write(
        `grade ${grade}: ${missing.length} characters are in no slice: ${missing.join('')}\n`);
      process.exitCode = 1;
    }
  }
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
    const list = [];
    for (const lit of literals) {
      const character = byLiteral.get(lit);
      if (!character) { missing.push(`${set.id} ${lit}`); continue; }
      doc[lit] = toEntry(character);
      list.push({
        id: `k_${lit.codePointAt(0).toString(16)}`, literal: lit, strokes: doc[lit].strokes,
      });
    }
    doc.list = list;
    total += literals.length;
    writeData(path.join(SITE, 'data', 'kanji', `kanjidic-${set.id}.json`), doc,
      set.budget_kb, ESCAPE);
  }

  checkSlices(sel);

  if (missing.length) {
    process.stderr.write(`\n${missing.length} characters are not in KANJIDIC2:\n`);
    for (const m of missing) process.stderr.write(`  ${m}\n`);
    process.exitCode = 1;
  }
  process.stdout.write(`${total} kanji from ${SOURCES.kanjidic.name} ${SOURCES.kanjidic.release}\n`);
}

main();
