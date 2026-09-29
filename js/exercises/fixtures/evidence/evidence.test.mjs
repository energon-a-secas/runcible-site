// The evidence cap: ungraded attempts never push earned ones out.
//
//   node --test js/exercises/fixtures/evidence/evidence.test.mjs
//   npm test
//
// C8.2 caps a skill's stored attempts at 200, and C3.4 says a correct: null
// attempt counts toward nothing. Until 2026-09-28 the cap trimmed the plain
// oldest records, so a learner who earned a chapter with twenty right answers
// and then read pages or sang along two hundred times (each one a null attempt
// under the same skill) found the chapter locked again, with nothing graded
// left in the window and no error anywhere. These run js/progress.js itself,
// under plain node, against the shell's own state.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { state, EVIDENCE_CAP } from '../../../state.js';
import { recordAttempt, evidenceStatus, attemptsFor, capEvidence } from '../../../progress.js';

const BOOK = 'fixture-book';
const SKILL = 'fixture.skill';
const GOAL = { skill: SKILL, window: 40, min: 12, accuracy: 0.8 };
const CTX = { bookId: BOOK, chapterId: 'c1', exerciseId: 'e1' };

function fresh() {
  state.progress = { books: {} };
}

function answer(i, correct) {
  return recordAttempt({ itemId: `item-${i}`, skill: SKILL, correct, ms: 100 }, CTX);
}

test('twenty right answers survive two hundred ungraded attempts', () => {
  fresh();
  for (let i = 0; i < 20; i++) answer(i, true);
  assert.equal(evidenceStatus(BOOK, GOAL).ok, true, 'passes before the ungraded run');
  for (let i = 0; i < 200; i++) answer(`null-${i}`, null);
  const after = evidenceStatus(BOOK, GOAL);
  assert.equal(after.ok, true, 'still passes after 200 null attempts');
  assert.equal(after.graded, 20);
  assert.equal(after.correct, 20);
  const list = attemptsFor(BOOK, SKILL);
  assert.equal(list.length, EVIDENCE_CAP, 'the list is still held to the cap');
  assert.equal(list.filter((a) => a.correct === true).length, 20, 'every graded record is kept');
});

test('the oldest ungraded records are the ones dropped, and order is kept', () => {
  fresh();
  answer('n-old', null);
  for (let i = 0; i < EVIDENCE_CAP - 1; i++) answer(i, i % 2 === 0);
  answer('n-new', null);
  const list = attemptsFor(BOOK, SKILL);
  assert.equal(list.length, EVIDENCE_CAP);
  assert.equal(list.some((a) => a.itemId === 'item-n-old'), false, 'the older null went first');
  assert.equal(list[list.length - 1].itemId, 'item-n-new', 'the newest record is still last');
  const ats = list.map((a) => a.at);
  assert.deepEqual([...ats].sort((x, y) => x - y), ats, 'still oldest first');
});

test('with nothing ungraded left, the oldest graded record goes', () => {
  fresh();
  for (let i = 0; i < EVIDENCE_CAP + 50; i++) answer(i, i >= 50);
  const list = attemptsFor(BOOK, SKILL);
  assert.equal(list.length, EVIDENCE_CAP);
  assert.equal(list[0].itemId, 'item-50', 'the fifty oldest graded records were trimmed');
  assert.equal(list.every((a) => a.correct === true), true);
});

test('a null arriving at a full graded list is the one not kept', () => {
  fresh();
  for (let i = 0; i < EVIDENCE_CAP; i++) answer(i, true);
  answer('late-null', null);
  const list = attemptsFor(BOOK, SKILL);
  assert.equal(list.length, EVIDENCE_CAP);
  assert.equal(list.some((a) => a.itemId === 'item-late-null'), false);
  assert.equal(list[0].itemId, 'item-0', 'no graded record was pushed out by it');
});

test('capEvidence leaves a list under the cap alone', () => {
  const list = [{ correct: null }, { correct: true }];
  assert.equal(capEvidence(list, 5), list);
  assert.equal(list.length, 2);
});
