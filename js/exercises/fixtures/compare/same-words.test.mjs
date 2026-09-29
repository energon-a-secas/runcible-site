// speak's comparison: which neutral line the learner sees, never a grade.
//
//   node --test js/exercises/fixtures/compare/same-words.test.mjs
//   npm test
//
// C2.5 keeps speak ungraded, so sameWords only picks between "Heard the same
// words" and "Heard: X, expected: Y". It forgives what a recogniser does on
// its own (a full stop added or not, fullwidth forms, spacing) and applies the
// spec's own compare tokens, so the syllabary fold happens only when asked.
// The strings are built from code points so this file names no script.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sameWords } from '../../compare.js';

const cp = (...codes) => String.fromCodePoint(...codes);
// Two syllables in the first block, the same two in the second, and the
// ideographic full stop a recogniser may or may not add.
const FIRST = cp(0x3042, 0x3044);
const SECOND = cp(0x30a2, 0x30a4);
const STOP = cp(0x3002);

test('punctuation and spacing a recogniser adds do not count', () => {
  assert.equal(sameWords('Good morning.', 'good morning'), true);
  assert.equal(sameWords('good  morning!', 'Good morning'), true);
  assert.equal(sameWords(FIRST + STOP, FIRST), true);
  assert.equal(sameWords(`${FIRST} ${FIRST}`, FIRST + FIRST), true);
});

test('fullwidth forms fold to their ordinary width', () => {
  assert.equal(sameWords(cp(0xff41, 0xff42, 0xff43), 'abc'), true);
});

test('the syllabary fold runs only when the spec asks for it', () => {
  assert.equal(sameWords(SECOND, FIRST), false, 'no kana token, no fold');
  assert.equal(sameWords(SECOND, FIRST, 'trim|kana'), true);
});

test('different words, or nothing heard, are not the same', () => {
  assert.equal(sameWords('good evening', 'good morning'), false);
  assert.equal(sameWords('', 'good morning'), false);
  assert.equal(sameWords(STOP, FIRST), false, 'punctuation alone is nothing heard');
});

test('any accepted form of the line matches', () => {
  assert.equal(sameWords('tomorrow', ['today', 'tomorrow']), true);
});
