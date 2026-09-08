// "Your misses" built from the real Book, and validated by Rappel's own
// validator before anything is ever posted to a frame.
//
//   node --test js/exercises/fixtures/misses/misses.test.mjs
//   npm test
//
// Two fixtures, as DESIGN-MISSES.md asks for: one whose cards are all public
// domain, one that mixes in a share-alike set. They are progress stores, not
// decks, so what is asserted is the builder's output over the corpus this Book
// actually ships. A card whose set is renamed, an item that is deleted or a
// licence that changes therefore fails here rather than in a learner's frame.
//
// The deck schema belongs to Rappel (C4), so this imports that validator rather
// than writing a second notion of valid.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { state } from '../../../state.js';
import { buildMissesDeck, missKey, missesDeckId, noteIdFor } from '../../../misses.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');
const BOOK_DIR = 'books/japanese/';

const { validateDeck, formatReport } = await import(
  pathToFileURL(resolve(ROOT, '../rappel-site/tools/validate-deck.mjs')).href);

const readJson = async (rel) => JSON.parse(await readFile(join(ROOT, rel), 'utf8'));

const book = await readJson(BOOK_DIR + 'book.json');
book.dir = BOOK_DIR;

const docs = new Map();
for (const entry of book.chapters) {
  if (!entry.src) continue;
  docs.set(entry.id, await readJson(BOOK_DIR + entry.src));
}

/** The C3.2 fragment rule, as js/books.js resolves it. */
function fragment(doc, frag) {
  if (!frag) return doc;
  if (doc && typeof doc === 'object' && Object.prototype.hasOwnProperty.call(doc, frag)) return doc[frag];
  let cur = doc;
  for (const key of frag.split('.')) cur = cur[key];
  return cur;
}

/**
 * The reader js/misses.js is handed. It asserts C1.3 rule 2 the way the shell
 * does: a file the manifest did not declare is not readable, here either.
 */
async function read(pointer) {
  const cut = pointer.indexOf('#');
  const src = cut < 0 ? pointer : pointer.slice(0, cut);
  assert.ok((book.data || []).some((d) => d.src === src), `${src} is not declared in the manifest's data[]`);
  const doc = await readJson(src);
  return { src, doc, value: fragment(doc, cut < 0 ? '' : pointer.slice(cut + 1)) };
}

async function build(fixture, lang = 'en') {
  state.prefs = { ...state.prefs, lang, bookId: 'japanese' };
  return buildMissesDeck(book, docs, read);
}

async function load(fixture) {
  state.progress = await readJson(`js/exercises/fixtures/misses/${fixture}.json`);
}

/**
 * A19 widens C4 for `personal:` ids and for a `YYYY-MM-DD.N` version, and the
 * engine passes `personal: true` from the one door such a deck comes through,
 * the rappel:load handler. This validates the same way that handler does.
 *
 * The probe is here because the two sites deploy separately: an engine that
 * predates A19 refuses the namespace outright, and the deck is then validated
 * under a plain id so everything else in the document is still asserted and the
 * one pending item is named out loud rather than passing quietly.
 */
const A19_LANDED = validateDeck({
  format: 'neo-deck/1', id: 'personal:runcible:x', version: '2026-09-08.1',
  name: 'x', lang: { front: 'ja', back: 'en' }, fields: ['F'],
  templates: [{ id: 't', kind: 'basic', skill: 'a.b', front: '{{F}}', back: '{{F}}' }],
  notes: [{ id: 'n_1', f: { F: 'x' } }],
}, { personal: true }).ok;

function mustValidate(deck, name) {
  const doc = A19_LANDED
    ? deck
    : { ...deck, id: 'personal-runcible-japanese', version: deck.version.split('.')[0] };
  const report = validateDeck(doc, { name, personal: true });
  assert.ok(report.ok, formatReport(report, name));
  if (!A19_LANDED) {
    console.log(`  [pending] ${name}: this build of rappel-site has not widened C4 for personal: `
      + `ids yet, so the deck was validated as "${doc.id}" v${doc.version}`);
  }
}

const noteOf = (deck, key) => deck.notes.find((n) => n.f.Key === key);

test('public domain fixture: the cards, the keys, and the merge', async () => {
  await load('progress-public-domain');
  const built = await build();
  assert.ok(built, 'a miss should have produced a deck');
  mustValidate(built.deck, 'your misses, public domain');

  assert.equal(built.deck.id, missesDeckId('japanese'));
  assert.match(built.deck.version, /^\d{4}-\d{2}-\d{2}\.\d+$/);
  assert.deepEqual(built.deck.name, { en: 'Your misses', es: 'Tus fallos' });
  assert.deepEqual(built.deck.lang, { front: 'ja', back: 'en' });
  assert.deepEqual(built.deck.fields, ['Front', 'Back', 'Why', 'From', 'Key']);
  assert.equal(built.deck.templates.length, 1);
  assert.equal(built.deck.templates[0].back, '{{Back}}<br>{{Why}}<br>{{From}}');

  // Four cards: one sound (missed twice, in two exercises over one set), one
  // pairs of the same item id in another set, one order, one generic typed.
  assert.equal(built.cards, 4);
  const sound = noteOf(built.deck, missKey('quiz', 'jp-hiragana-sound', 'hira-a'));
  const pairs = noteOf(built.deck, missKey('quiz', 'jp-hiragana-pairs', 'hira-a'));
  const order = noteOf(built.deck, missKey('quiz', 'jp-song-sakura-sakura-order', 'sakura-sakura-v1-l1'));
  const typed = noteOf(built.deck, missKey('shell', '1-hiragana', 'kana:あ'));
  for (const [name, note] of [['sound', sound], ['pairs', pairs], ['order', order], ['typed', typed]]) {
    assert.ok(note, `${name} card is missing`);
  }

  assert.equal(sound.f.Front, 'あ');
  assert.equal(sound.f.Back, 'a · vowels');
  assert.equal(sound.skill, 'kana.hiragana.read');
  assert.equal(sound.f.From, 'From Hiragana sounds');
  assert.equal(pairs.f.Front, 'あ');
  assert.equal(pairs.f.Back, 'a');
  assert.equal(typed.f.Front, 'a');
  assert.equal(typed.f.Back, 'あ');
  assert.equal(typed.skill, 'kana.hiragana.write');
  assert.ok(order.f.Front.startsWith('Cherry blossoms'), order.f.Front);
  assert.ok(order.f.Back.startsWith('さくら さくら'), order.f.Back);

  // The same item missed in two exercises over one set is one card, counted
  // twice, and dated by the newer of the two.
  const row = [...built.rows.values()].find((r) => r.key === sound.f.Key);
  assert.equal(row.n, 2);
  assert.equal(row.itemId, 'hira-a');
  assert.equal(row.chapterId, '1-hiragana');

  // A correct answer, a rappel review and a synced record are never cards, and
  // an item that has left its set is skipped rather than guessed at.
  for (const note of built.deck.notes) assert.ok(!note.f.Key.includes('hira-i'));
  for (const note of built.deck.notes) assert.ok(!note.f.Key.includes('hira-ka'));
  assert.equal(built.skipped, 1);

  // All public domain: nothing is owed on screen.
  assert.equal(built.deck.licence, 'public-domain');
  assert.equal(built.deck.screen, 'none');
  assert.equal(built.deck.attribution, undefined);
});

test('mixed fixture: the strictest licence travels, and the wording with it', async () => {
  await load('progress-mixed');
  const built = await build();
  assert.ok(built);
  mustValidate(built.deck, 'your misses, mixed');

  assert.equal(built.cards, 6);
  assert.equal(built.deck.licence, 'CC-BY-SA-4.0', 'share-alike wins over public domain');
  assert.equal(built.deck.screen, 'required');
  assert.match(built.deck.attribution, /JMdict/);
  assert.match(built.deck.source, /^https:\/\//);

  const beats = noteOf(built.deck, missKey('quiz', 'jp-loanwords-beats', 'lw-robotto'));
  assert.equal(beats.f.Front, 'ロボット');
  assert.equal(beats.f.Back, '4 beats · ロ・ボ・ッ・ト');
  assert.ok(beats.f.Why.startsWith('A stranded t or d'), beats.f.Why);

  // A pairs item with a note of its own carries it after the separator.
  const word = noteOf(built.deck, missKey('quiz', 'jp-first-words-pairs', 'w_0013'));
  assert.equal(word.f.Back, 'please · おねがいします');
});

test('the version moves only when the content does', async () => {
  await load('progress-mixed');
  const first = await build();
  const again = await build();
  assert.equal(again.deck.version, first.deck.version, 'an unchanged rebuild is the same document');
  assert.deepEqual(again.deck.notes.map((n) => n.id), first.deck.notes.map((n) => n.id));

  // A language switch is a rebuild: the cards are in Spanish, the note ids do
  // not move (so the scheduling survives) and the version says something
  // changed (so the engine takes the new one).
  const es = await build('progress-mixed', 'es');
  assert.deepEqual(es.deck.notes.map((n) => n.id), first.deck.notes.map((n) => n.id));
  assert.notEqual(es.deck.version, first.deck.version);
  assert.equal(es.deck.version.split('.')[0], first.deck.version.split('.')[0], 'same day, a greater N');
  assert.ok(Number(es.deck.version.split('.')[1]) > Number(first.deck.version.split('.')[1]));
  assert.equal(es.deck.lang.back, 'es');
  const beats = noteOf(es.deck, missKey('quiz', 'jp-loanwords-beats', 'lw-robotto'));
  assert.equal(beats.f.Back, '4 tiempos · ロ・ボ・ッ・ト');
  assert.equal(beats.f.From, 'De Pulsos de préstamos');
  const word = noteOf(es.deck, missKey('quiz', 'jp-first-words-pairs', 'w_0013'));
  assert.equal(word.f.Back, 'por favor · おねがいします');
});

test('the cap keeps the newest 200 and drops the rest', async () => {
  // Two sets of about a hundred items each, every one of them missed, oldest
  // first: more misses than the deck may hold, out of the Book's own corpus.
  const sound = await readJson('books/japanese/sets/jp-hiragana-sound.json');
  const pairs = await readJson('books/japanese/sets/jp-hiragana-pairs.json');
  const base = Date.parse('2026-09-01T08:00:00Z');
  const evidence = [];
  const push = (items, exerciseId) => items.forEach((it) => evidence.push({
    at: base + evidence.length * 60000, itemId: it.id, skill: 'kana.hiragana.read',
    correct: false, ms: 1200, bookId: 'japanese', chapterId: '1-hiragana',
    exerciseId, source: 'quiz',
  }));
  push(sound.items, 'e-vowels-read');
  push(pairs.items, 'e-mixed-pairs');
  assert.ok(evidence.length > 200, `the fixture must overflow the cap, got ${evidence.length}`);
  state.progress = { books: { japanese: { chapters: {}, evidence: { 'kana.hiragana.read': evidence }, decks: {} } } };

  const built = await build();
  assert.equal(built.cards, 200);
  mustValidate(built.deck, 'your misses, at the cap');
  const keys = new Set(built.deck.notes.map((n) => n.f.Key));
  const dropped = evidence.length - 200;
  for (const a of evidence.slice(0, dropped)) {
    assert.ok(!keys.has(missKey('quiz', 'jp-hiragana-sound', a.itemId)), `${a.itemId} is older than the cap and should have dropped`);
  }
  const newest = evidence[evidence.length - 1];
  assert.ok(keys.has(missKey('quiz', 'jp-hiragana-pairs', newest.itemId)), 'the newest miss must be in the deck');
});

test('a note id is the key and nothing else', async () => {
  const key = missKey('quiz', 'jp-hiragana-sound', 'hira-a');
  assert.equal(await noteIdFor(key), await noteIdFor(key));
  assert.match(await noteIdFor(key), /^m_[0-9a-f]{12}$/);
  assert.notEqual(await noteIdFor(key), await noteIdFor(missKey('quiz', 'jp-hiragana-pairs', 'hira-a')));
  // A note id may not hold a colon: card identity is noteId + ":" + templateId.
  assert.ok(!(await noteIdFor(missKey('shell', '1-hiragana', 'kana:あ'))).includes(':'));
});

test('no misses is no deck, not an empty one', async () => {
  state.progress = { books: { japanese: { chapters: {}, evidence: {}, decks: {} } } };
  assert.equal(await build(), null);
});
