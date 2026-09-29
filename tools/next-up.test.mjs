// Optional exercises: shown, run and recorded, never what decides "next".
//
//   node --test tools/next-up.test.mjs
//   npm test
//
// Commit 584a1d2 put a memory-hint drill at the head of seven row rungs in
// chapters 1 and 2. A learner who had finished those rungs then held an
// unfinished drill at the start of each, so the bookmark, "Continue reading"
// and the facing page's Next up all went back to the first row, with no error
// anywhere. The seven are now `optional: true`, and js/next-up.js is the one
// place that reads the flag.
//
// The proof runs the shell's own functions over the real chapter files, under
// plain node, against a copy of each with its optional drills removed: that
// copy is the chapter as it was before the hints existed. Every progress
// store below yields the same bookmark from both, and the same store with the
// flag stripped does not, so the comparison cannot pass by being vacuous.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { state } from '../js/state.js';
import { markExercise, recordAttempt } from '../js/progress.js';
import { createExerciseRegistry, validateExerciseSpec } from '../js/exercises/index.js';
import {
  isOptional, countsTowardDone, firstUnfinishedRung, nextDrill, pickGame, isGraded,
} from '../js/next-up.js';
import { validateChapter } from './validate-book.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BOOK_DIR = 'books/japanese/';
const BOOK = 'japanese';
const readJson = async (rel) => JSON.parse(await readFile(join(ROOT, rel), 'utf8'));

const book = await readJson(BOOK_DIR + 'book.json');

// The registry the page builds, with the Book's own modules in it, so a
// module registered `graded: false` (the name drill in chapter 2) is judged
// here exactly as the page judges it.
const registry = createExerciseRegistry();
for (const mod of book.modules) {
  const ns = await import(pathToFileURL(join(ROOT, BOOK_DIR, mod.path)).href);
  registry.registerBookModule({ bookId: BOOK, path: mod.path, register: ns.default, provides: mod.provides });
}
const implOf = registry.exerciseImpl;

const HINTS = {
  '1-hiragana': ['e-vowels-hints', 'e-kst-hints', 'e-nhm-hints', 'e-yrw-hints'],
  '2-katakana': ['e-kata-a-k-hints', 'e-kata-middle-hints', 'e-kata-yrw-hints'],
};

const chapters = {};
for (const id of Object.keys(HINTS)) {
  const entry = book.chapters.find((c) => c.id === id);
  chapters[id] = await readJson(BOOK_DIR + entry.src);
}

/** The chapter as it was before the hints existed: its optional drills gone. */
function withoutOptional(doc) {
  const copy = structuredClone(doc);
  for (const rung of copy.rungs) rung.exercises = (rung.exercises || []).filter((ex) => !isOptional(ex));
  return copy;
}

/** The chapter as it would be had the flag never been added. */
function flagStripped(doc) {
  const copy = structuredClone(doc);
  for (const rung of copy.rungs) for (const ex of rung.exercises || []) delete ex.optional;
  return copy;
}

const hintRungs = (doc) => doc.rungs.filter((r) => (r.exercises || []).some(isOptional));

function fresh() {
  state.progress = { books: {} };
}

function finish(chapterId, ex) {
  markExercise(BOOK, chapterId, ex.id, { accuracy: 1 });
}

const bookmark = (doc) => firstUnfinishedRung(BOOK, doc, implOf).id;

test('the seven hint drills are the optional ones, and nothing else is', () => {
  for (const [id, ids] of Object.entries(HINTS)) {
    const found = chapters[id].rungs.flatMap((r) => (r.exercises || []).filter(isOptional).map((ex) => ex.id));
    assert.deepEqual(found, ids, `${id}: the optional drills`);
    for (const rung of hintRungs(chapters[id])) {
      assert.ok(isOptional(rung.exercises[0]), `${id}/${rung.id}: the hint still opens its rung`);
      assert.ok(isGraded(rung.exercises[0], implOf), `${id}/${rung.id}: the hint still grades and records`);
      assert.equal(countsTowardDone(rung.exercises[0], implOf), false);
    }
  }
});

test('every other drill of the hint rungs done: the bookmark is where it was before the hints', () => {
  for (const id of Object.keys(HINTS)) {
    const doc = chapters[id];
    const before = withoutOptional(doc);
    fresh();
    for (const rung of hintRungs(doc)) for (const ex of rung.exercises) if (!isOptional(ex)) finish(id, ex);
    const at = bookmark(doc);
    assert.equal(at, bookmark(before), `${id}: same bookmark as the chapter without its hints`);
    assert.ok(!hintRungs(doc).some((r) => r.id === at), `${id}: past every hint rung, on ${at}`);
    // The same store over the same chapter with no flag: back to the first
    // row, which is the regression this field exists to undo.
    assert.equal(bookmark(flagStripped(doc)), hintRungs(doc)[0].id, `${id}: without the flag it moves back`);
  }
});

test('drill by drill through the chapter, the bookmark never differs from the chapter without hints', () => {
  for (const id of Object.keys(HINTS)) {
    const doc = chapters[id];
    const before = withoutOptional(doc);
    const counted = doc.rungs.flatMap((r) => (r.exercises || []).filter((ex) => countsTowardDone(ex, implOf)));
    fresh();
    for (let n = 0; n <= counted.length; n++) {
      if (n) finish(id, counted[n - 1]);
      assert.equal(bookmark(doc), bookmark(before), `${id}: after ${n} of ${counted.length} drills`);
    }
  }
});

test('doing only the hints finishes no rung', () => {
  for (const id of Object.keys(HINTS)) {
    const doc = chapters[id];
    fresh();
    for (const rung of hintRungs(doc)) finish(id, rung.exercises[0]);
    assert.equal(bookmark(doc), hintRungs(doc)[0].id, `${id}: still on the first row`);
  }
});

test('Next up on a hint rung is the drill it was before the hints', () => {
  for (const id of Object.keys(HINTS)) {
    const doc = chapters[id];
    const before = withoutOptional(doc);
    for (const rung of hintRungs(doc)) {
      const old = before.rungs.find((r) => r.id === rung.id);
      fresh();
      assert.equal(nextDrill(BOOK, id, rung.exercises).id, nextDrill(BOOK, id, old.exercises).id, `${rung.id}: nothing done`);
      assert.equal(isOptional(nextDrill(BOOK, id, rung.exercises)), false);
      for (const ex of old.exercises) {
        finish(id, ex);
        assert.equal(nextDrill(BOOK, id, rung.exercises).id, nextDrill(BOOK, id, old.exercises).id, `${rung.id}: after ${ex.id}`);
      }
    }
  }
});

test('a rung of optional drills alone still offers one as Next up', () => {
  fresh();
  const drills = [{ id: 'a', optional: true }, { id: 'b', optional: true }];
  assert.equal(nextDrill(BOOK, 'c', drills).id, 'a');
  markExercise(BOOK, 'c', 'a', { accuracy: 1 });
  assert.equal(nextDrill(BOOK, 'c', drills).id, 'b');
  assert.equal(nextDrill(BOOK, 'c', []), null);
});

test('the day\'s drill is never an optional one', () => {
  const pool = [];
  for (const [id, doc] of Object.entries(chapters)) {
    for (const rung of doc.rungs) {
      for (const ex of rung.exercises || []) if (isGraded(ex, implOf)) pool.push({ chapterId: id, rungId: rung.id, exercise: ex });
    }
  }
  assert.ok(pool.some((item) => isOptional(item.exercise)), 'the pool does hold the hints');

  fresh();
  const first = pickGame(BOOK, pool);
  assert.equal(isOptional(first.exercise), false, `first visit: ${first.exercise.id}`);

  // Weak on the very skill every hint drill records under: the skill search
  // used to land on the hint, the first drill of the pool with that skill.
  for (const skill of ['kana.hiragana.read', 'kana.katakana.read']) {
    for (let i = 0; i < 5; i++) {
      recordAttempt({ itemId: `x-${i}`, skill, correct: false, ms: 100 }, { bookId: BOOK, chapterId: 'c', exerciseId: 'e' });
    }
  }
  const weak = pickGame(BOOK, pool);
  assert.ok(weak.because, 'picked for a weak skill');
  assert.equal(isOptional(weak.exercise), false, `weak skill: ${weak.exercise.id}`);

  fresh();
  for (const item of pool) if (!isOptional(item.exercise)) markExercise(BOOK, item.chapterId, item.exercise.id, { accuracy: 1 });
  const done = pickGame(BOOK, pool);
  assert.equal(isOptional(done.exercise), false, `every counted drill done: ${done.exercise.id}`);

  assert.equal(pickGame(BOOK, pool.filter((item) => isOptional(item.exercise))), null, 'an all-optional pool has no game');
});

test('optional is a boolean, and the validator says so', () => {
  const spec = { id: 'e-x', type: 'custom', module: 'x.y', skill: 'a.b' };
  assert.deepEqual(validateExerciseSpec({ ...spec, optional: true }), []);
  assert.deepEqual(validateExerciseSpec({ ...spec, optional: false }), []);
  assert.deepEqual(validateExerciseSpec(spec), []);
  for (const bad of ['true', 'yes', 1, 0, null, {}]) {
    const problems = validateExerciseSpec({ ...spec, optional: bad });
    assert.equal(problems.length, 1, `optional: ${JSON.stringify(bad)}`);
    assert.match(problems[0], /"optional" must be true or false/);
  }

  // Through the Book validator too, which is what make validate and the page
  // at load time run, naming the drill's place in the file.
  const doc = structuredClone(chapters['1-hiragana']);
  assert.equal(validateChapter(doc, book).ok, true, 'the shipped chapter is valid');
  const rung = doc.rungs.findIndex((r) => (r.exercises || []).some(isOptional));
  doc.rungs[rung].exercises[0].optional = 'true';
  const report = validateChapter(doc, book);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((e) => e.path === `rungs[${rung}].exercises[0]` && /"optional"/.test(e.message)),
    JSON.stringify(report.errors));
});
