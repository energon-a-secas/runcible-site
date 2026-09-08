#!/usr/bin/env node
/**
 * Quiz sets, format neo-quiz-set/1 (quiz-site/llms.txt is the contract).
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 * Run it by hand, read the numbers, commit the output, never wire it into CI
 * or `make serve`:
 *
 *   node tools/build-sets.mjs
 *   cd ../quiz-site && node tools/validate-set.mjs   # the gate on what it wrote
 *
 * Writes each set twice, from one source, so the two copies cannot drift:
 *   ../quiz-site/data/sets/<id>.json        Quiz's own library, plus index.json
 *   books/japanese/sets/<id>.json           the copy a Runcible chapter embeds
 *
 * Four games: beats from data/loanwords (seed.json, with rules.json behind the
 * explain lines), sound from the two kana tables (one set per script, gojuon,
 * dakuten, yoon and the extended katakana digraphs, each item carrying its row
 * and column), pairs from the same tables (kana to romaji, row and column
 * carried too) and data/vocab/ch4.json (word to meaning, the reading never on
 * the board, the rung carried as group), order from data/songs (one set per
 * song, the pieces cut on the word boundaries the corpus's own romaji line
 * records, aligned back onto the kana; see songPieces). quiz-site/data/README.md
 * records what each set carries and what could not be derived.
 *
 * THE ONE RULE THAT MATTERS HERE. An item id is derived from the corpus id of
 * the record it came from, never from its position, so a re-run over the same
 * corpus emits the same ids. quiz:answer carries that id as itemId and
 * Runcible stores it as evidence; an id that moves between runs orphans every
 * attempt a person made on that item, and nothing would report it. The
 * transliteration in lib/sets-kana.mjs exists only to make those ids ASCII:
 * change it and every loanword id moves.
 *
 * Nothing here supplies Japanese or English of its own. A beat split is
 * mechanical from the katakana; the rule pointer and the explain line come
 * from the corpus (a word's own explain line first, then its rule's line from
 * rules.json), and where it has neither the item carries null. A beats romaji
 * is the corpus's own line when it has one and otherwise read off the kana
 * through the tables (see hepburn), macron style either way and never null;
 * the derived line is checked against every corpus line, so the fallback is
 * not a path nobody has run. The Spanish a corpus slice has none of, a first
 * words meaning and a song gloss, is written in tools/selection/sets.json
 * (meanings_es, glosses_es) and carried across as it stands: this file
 * translates nothing, and a record the selection does not name ships with
 * es null so the reader gets the English and the honesty line. Derived
 * data inherits its source's licence: JMdict-derived sets are CC BY-SA 4.0
 * with screen "required" in EDRDG's own words, the kana tables and the songs
 * are public domain, and a song set carries the authors' death years because
 * they are the whole basis of the verdict.
 *
 * WHERE THE WORK LIVES. This file is the entry point and the contract above;
 * each builder is a module of its own, and none of them is over 500 lines:
 *   lib/sets-common.mjs      the run's skipped list, readData, bilingual, TOOL
 *   lib/sets-kana.mjs        reading kana: moraSplit, romajiMap, idRomaji, hepburn
 *   lib/sets-beats.mjs       beats, from data/loanwords
 *   lib/sets-kana-games.mjs  sound and kana-pairs, from one kana table
 *   lib/sets-vocab.mjs       vocab-pairs, from a data/vocab slice
 *   lib/sets-songs.mjs       order, one set per song in data/songs
 */
import fs from 'node:fs';
import path from 'node:path';
import { SITE, readSelection, writeData } from './lib/corpus.mjs';
import { TOOL, skipped } from './lib/sets-common.mjs';
import { beatsSet } from './lib/sets-beats.mjs';
import { kanaPairsSet, soundSet } from './lib/sets-kana-games.mjs';
import { vocabPairsSet } from './lib/sets-vocab.mjs';
import { songSets } from './lib/sets-songs.mjs';

// The pure functions, re-exported from the entry point so a check in tools/
// can keep importing them from the file it has always named.
export {
  digraphOnset, digraphSound, hepburn, idRomaji, moraSplit,
} from './lib/sets-kana.mjs';
export { fold } from './lib/sets-vocab.mjs';
export { alignRomaji, joinPieces, songPieces } from './lib/sets-songs.mjs';

/**
 * The `version` every set carries, a YYYY-MM-DD date the contract asks to be
 * bumped on any content change. It is this file's own constant rather than the
 * corpus's GENERATED_AT because a set changes when the generator changes, not
 * only when the corpus does: adding the yoon rows moved no corpus file.
 */
const VERSION = '2026-09-07';
const FORMAT = 'neo-quiz-set/1';
const INDEX_FORMAT = 'neo-quiz-set-index/1';

const BUILDERS = { beats: beatsSet, sound: soundSet, 'kana-pairs': kanaPairsSet, 'vocab-pairs': vocabPairsSet };
const GAME = { beats: 'beats', sound: 'sound', 'kana-pairs': 'pairs', 'vocab-pairs': 'pairs', order: 'order' };

function main() {
  const sel = readSelection('sets.json');
  const QUIZ = path.resolve(SITE, sel.targets.quiz_site);
  const bookDir = path.join(SITE, 'books', sel.targets.runcible_book, 'sets');
  const quizDir = path.join(QUIZ, 'data', 'sets');
  const catalog = [];
  const jobs = [];

  for (const spec of sel.sets) {
    if (spec.kind === 'order') { jobs.push(...songSets(spec)); continue; }
    const build = BUILDERS[spec.kind];
    if (!build) throw new Error(`unknown set kind: ${spec.kind}`);
    jobs.push({
      id: spec.id, name: spec.name, skill: spec.skill, budget_kb: spec.budget_kb,
      built: build(spec), kind: spec.kind, escape: spec.escape || [],
    });
  }

  for (const job of jobs) {
    const { built } = job;
    const game = GAME[job.kind || 'order'];
    const set = {
      format: FORMAT,
      id: job.id,
      version: VERSION,
      game,
      name: job.name,
      lang: built.lang,
      skill: job.skill,
      licence: built.licence,
      _licence: built._licence,
      ...(built.groups && Object.keys(built.groups).length ? { groups: built.groups } : {}),
      items: built.items,
    };
    const quizPath = path.join(quizDir, `${job.id}.json`);
    const bookPath = path.join(bookDir, `${job.id}.json`);
    // `escape` is the selection row's, and it is empty on every set but the
    // grade 2 kanji one. See writeData in lib/corpus.mjs: one character of
    // KANJIDIC's own grade 2 list is also the whole title of a banned song, so
    // a slice that carries it is emitted with that character escaped. The
    // parsed value is identical and both copies get the same bytes, so the cmp
    // below still holds.
    writeData(quizPath, set, job.budget_kb, job.escape);
    writeData(bookPath, set, job.budget_kb, job.escape);
    if (!fs.readFileSync(quizPath).equals(fs.readFileSync(bookPath))) {
      throw new Error(`${job.id}: the two copies differ, which the writer makes impossible`);
    }
    catalog.push({
      id: job.id,
      // `file` is relative to the Quiz site root, the way Rappel's index names decks.
      file: `data/sets/${job.id}.json`,
      game,
      name: job.name,
      items: built.items.length,
      licence: built.licence.spdx,
      screen: built.licence.screen,
    });
    process.stdout.write(`  ${job.id}: ${built.summary}\n`);
    for (const note of built.notes || []) process.stdout.write(`    note: ${note}\n`);
  }

  // A static site cannot list a directory, so the library reads one file.
  const index = {
    _note: `Generated by runcible-site/${TOOL}. Each set it names carries its own licence block; this index carries none of its own.`,
    format: INDEX_FORMAT,
    version: VERSION,
    sets: catalog,
  };
  writeData(path.join(quizDir, 'index.json'), index, 40);

  process.stdout.write(`\n${catalog.length} sets, ${catalog.reduce((a, s) => a + s.items, 0)} items\n`);
  if (skipped.length) {
    process.stdout.write(`\n${skipped.length} could not be derived from the corpus:\n`);
    for (const s of skipped) process.stdout.write(`  ${s}\n`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('build-sets.mjs')) main();
