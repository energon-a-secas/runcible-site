// A Book's tools and reading runs: the manifest checks, the run splitter, the
// Yomu host's pure half and the tool route, with no DOM.
//
//   node --test tools/book-tools.test.mjs
//   npm test
//
// The Japanese Book ships with one tool and lang.runs. The tests start from a
// copy with both keys removed (bare), which is the proof that the change is
// additive: a Book without them still validates with nothing new to say. The
// shipped keys are asserted equal to TOOL and RUNS below, so the manifest and
// these checks cannot drift apart.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateManifest } from './lib/validate-manifest.mjs';
import {
  TOOL_EMBEDS, compileRuns, splitRuns, runsFor, toolsOf, findTool, readingTool,
} from '../js/book-tools.js';
import { yomuOrigin, yomuUrl, standaloneUrl, clip, acceptable, MAX_TEXT } from '../js/yomu-host.js';
import { parse, href } from '../js/router.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (rel) => JSON.parse(await readFile(join(ROOT, rel), 'utf8'));
const shipped = await readJson('books/japanese/book.json');
const bare = structuredClone(shipped);
delete bare.tools;
delete bare.lang.runs;

// Exactly what books/japanese/book.json declares (the test above checks it
// quotes): one tool, and runs for kana and kanji with the punctuation that
// belongs to them, joined across a single space so a spaced teaching line such
// as the kana column of a pattern table is one run.
const TOOL = {
  id: 'reader',
  embed: 'yomu',
  title: { en: 'Reader', es: 'Lector' },
  glyph: '読',
  description: {
    en: 'Paste any Japanese, or tap a phrase in a chapter, to see how it is read and built.',
    es: 'Pega cualquier texto en japonés, o toca una frase en un capítulo, para ver cómo se lee y cómo está hecho.',
  },
  reads: true,
};
const WORD = '[\\p{sc=Hira}\\p{sc=Kana}\\p{sc=Han}]';
const TAIL = '[\\p{sc=Hira}\\p{sc=Kana}\\p{sc=Han}\\u30fc\\u30fb\\u3001\\u3002\\u300c-\\u300f\\uff01\\uff1f\\u301c\\uff5e]*';
const OPEN = '[\\u300c\\u300e]?';
const RUNS = `${OPEN}${WORD}${TAIL}(?:[ \\u3000]+${OPEN}${WORD}${TAIL})*`;

const patched = (edit) => {
  const doc = structuredClone(bare);
  doc.lang.runs = RUNS;
  doc.tools = [structuredClone(TOOL)];
  if (edit) edit(doc);
  return doc;
};
const errorsAt = (doc) => validateManifest(doc).errors.map((e) => e.path);
const warningsAt = (doc) => validateManifest(doc).warnings.map((e) => e.path);

test('a Book without tools or runs is unchanged by this: valid, and nothing new to say', () => {
  const rep = validateManifest(bare);
  assert.equal(rep.ok, true, JSON.stringify(rep.errors));
  assert.deepEqual(rep.warnings, []);
});

test('the shipped Japanese Book declares exactly these keys', () => {
  assert.deepEqual(shipped.tools, [TOOL]);
  assert.equal(shipped.lang.runs, RUNS);
  const rep = validateManifest(shipped);
  assert.equal(rep.ok, true, JSON.stringify(rep.errors));
  assert.deepEqual(rep.warnings, []);
});

test('the tool and runs keys validate cleanly on their own', () => {
  const rep = validateManifest(patched());
  assert.equal(rep.ok, true, JSON.stringify(rep.errors));
  assert.deepEqual(rep.warnings, []);
  console.log(`  book.json "lang.runs": ${JSON.stringify(RUNS)}`);
  console.log(`  book.json "tools": ${JSON.stringify([TOOL])}`);
});

test('tools: every refusal trips on its own', () => {
  assert.deepEqual(errorsAt(patched((d) => { d.tools = {}; })), ['tools']);
  assert.deepEqual(errorsAt(patched((d) => { d.tools = ['reader']; })), ['tools[0]']);
  assert.deepEqual(errorsAt(patched((d) => { d.tools[0].id = 'Reader Tool'; })), ['tools[0].id']);
  assert.deepEqual(errorsAt(patched((d) => { delete d.tools[0].id; })), ['tools[0].id']);
  assert.deepEqual(errorsAt(patched((d) => { d.tools.push(structuredClone(TOOL)); })), ['tools[1].id']);
  assert.deepEqual(errorsAt(patched((d) => { d.tools[0].embed = 'dictionary'; })), ['tools[0].embed']);
  assert.deepEqual(errorsAt(patched((d) => { delete d.tools[0].embed; })), ['tools[0].embed']);
  assert.deepEqual(errorsAt(patched((d) => { delete d.tools[0].title; })), ['tools[0].title']);
  assert.deepEqual(errorsAt(patched((d) => { d.tools[0].title = { en: 'Reader', ja: 'x' }; })), ['tools[0].title.ja']);
  assert.deepEqual(errorsAt(patched((d) => { d.tools[0].title = { en: '<b>Reader</b>' }; })), ['tools[0].title.en']);
  assert.deepEqual(errorsAt(patched((d) => { d.tools[0].description = 7; })), ['tools[0].description']);
  assert.deepEqual(errorsAt(patched((d) => { d.tools[0].glyph = ''; })), ['tools[0].glyph']);
  assert.deepEqual(errorsAt(patched((d) => { d.tools[0].reads = 'yes'; })), ['tools[0].reads']);
  // Optional fields really are optional.
  const bare = patched((d) => { d.tools[0] = { id: 'reader', embed: 'yomu', title: 'Reader' }; });
  assert.equal(validateManifest(bare).ok, true);
});

test('tools: the two warnings, and only when earned', () => {
  assert.deepEqual(warningsAt(patched((d) => { d.tools[0].exercise = 'x.y'; })), ['tools[0].exercise']);
  assert.deepEqual(warningsAt(patched((d) => { delete d.lang.runs; })), ['tools']);
  assert.deepEqual(warningsAt(patched((d) => { delete d.lang.runs; d.tools[0].reads = false; })), []);
});

test('lang.runs: must compile, and must not match nothing', () => {
  assert.deepEqual(errorsAt(patched((d) => { d.lang.runs = 42; })), ['lang.runs']);
  assert.deepEqual(errorsAt(patched((d) => { d.lang.runs = ''; })), ['lang.runs']);
  assert.deepEqual(errorsAt(patched((d) => { d.lang.runs = '[a-'; })), ['lang.runs']);
  assert.deepEqual(errorsAt(patched((d) => { d.lang.runs = 'a*'; })), ['lang.runs']);
  assert.deepEqual(errorsAt(patched((d) => { d.lang.runs = 'a|'; })), ['lang.runs']);
  assert.deepEqual(errorsAt(patched((d) => { d.lang.runs = '\\b'; })), ['lang.runs']);
  assert.deepEqual(errorsAt(patched((d) => { d.lang.runs = '(?=a)'; })), ['lang.runs']);
  // The u flag is always on, so an escape it forbids is a compile error here
  // rather than a pattern that quietly means something else in the browser.
  assert.match(compileRuns('\\-x').error || '', /does not compile/);
  assert.ok(compileRuns('[a-z]+').re instanceof RegExp);
  assert.deepEqual(TOOL_EMBEDS, ['yomu']);
  assert.ok(Object.isFrozen(TOOL_EMBEDS));
});

test('runs split the chapter 14 prose the way a reader would tap it', async () => {
  const re = compileRuns(RUNS).re;
  const runs = (s) => splitRuns(s, re).filter((p) => typeof p !== 'string').map((p) => p.run);
  assert.deepEqual(runs('Somebody thanks you and the reply is どういたしまして. Next.'),
    ['どういたしまして']);
  // A spaced teaching line is one run; an English comma splits two.
  assert.deepEqual(runs('ends in また あした and'), ['また あした']);
  assert.deepEqual(runs('こちらこそ, お元気ですか'),
    ['こちらこそ', 'お元気ですか']);
  // The sentence's own full stop stays with it; the long mark never starts one.
  assert.deepEqual(runs('お疲れ様。 at the end'), ['お疲れ様。']);
  assert.deepEqual(runs('a ー b'), []);
  // The text round-trips: nothing is dropped or doubled.
  const s = 'x すみません y 迷惑 z';
  assert.equal(splitRuns(s, re).map((p) => (typeof p === 'string' ? p : p.run)).join(''), s);
  assert.deepEqual(splitRuns('no runs here', re), ['no runs here']);

  const ch = await readJson('books/japanese/chapters/14-phrases.json');
  let found = 0;
  for (const rung of ch.rungs) for (const page of rung.pages || []) {
    for (const para of [].concat(page.body?.en || [], page.note?.en || [])) found += runs(para).length;
  }
  assert.ok(found > 60, `expected the chapter's prose to hold dozens of runs, found ${found}`);
  console.log(`  chapter 14 English prose and notes: ${found} runs`);
});

test('the Book helpers find tools by id, first, and the one that reads', () => {
  const book = patched((d) => { d.tools.push({ id: 'other', embed: 'nowhere', title: 'x' }); });
  assert.deepEqual(toolsOf(book).map((x) => x.id), ['reader']);
  assert.equal(findTool(book).id, 'reader');
  assert.equal(findTool(book, 'reader').id, 'reader');
  assert.equal(findTool(book, 'other'), null);
  assert.equal(readingTool(book).id, 'reader');
  assert.equal(readingTool(bare), null);
  assert.equal(runsFor(bare), null);
  assert.ok(runsFor(book) instanceof RegExp);
});

test('Yomu origin, frame URL and standalone link', () => {
  const local = { hostname: 'localhost', protocol: 'http:' };
  const loop = { hostname: '127.0.0.1', protocol: 'http:' };
  const prod = { hostname: 'runcible.neorgon.com', protocol: 'https:' };
  assert.equal(yomuOrigin(local), 'http://localhost:8895');
  assert.equal(yomuOrigin(loop), 'http://127.0.0.1:8895');
  assert.equal(yomuOrigin(prod), 'https://yomu.neorgon.com');
  assert.equal(yomuUrl({ lang: 'es' }, { loc: prod }), 'https://yomu.neorgon.com/?embed=1&lang=es');
  assert.equal(yomuUrl({ lang: 'en' }, { loc: local }), 'http://localhost:8895/?embed=1&lang=en');
  // EMBED.md: text never travels in the frame URL.
  assert.ok(!yomuUrl({ lang: 'en' }, { loc: prod }).includes('#'));
  assert.equal(standaloneUrl('', { loc: prod }), 'https://yomu.neorgon.com/');
  assert.equal(standaloneUrl(' また あした ', { loc: prod }),
    `https://yomu.neorgon.com/#t=${encodeURIComponent('また あした')}`);
});

test('clip keeps yomu:load under its limit without splitting a pair', () => {
  assert.deepEqual(clip('abc'), { text: 'abc', clipped: false });
  const long = 'a'.repeat(MAX_TEXT - 1) + '𠮷' + 'b';
  const cut = clip(long);
  assert.equal(cut.clipped, true);
  assert.equal(cut.text.length, MAX_TEXT - 1);
  assert.equal(clip('a'.repeat(MAX_TEXT)).clipped, false);
});

test('acceptable: origin, source, version and namespace', () => {
  const win = {};
  const ok = { origin: 'http://localhost:8895', source: win, data: { v: 1, type: 'yomu:ready' } };
  assert.equal(acceptable(ok, 'http://localhost:8895', win), true);
  assert.equal(acceptable({ ...ok, origin: 'http://localhost:8880' }, 'http://localhost:8895', win), false);
  assert.equal(acceptable({ ...ok, source: {} }, 'http://localhost:8895', win), false);
  assert.equal(acceptable({ ...ok, data: { v: 2, type: 'yomu:ready' } }, 'http://localhost:8895', win), false);
  assert.equal(acceptable({ ...ok, data: { v: 1, type: 'quiz:ready' } }, 'http://localhost:8895', win), false);
  assert.equal(acceptable({ ...ok, data: 'yomu:ready' }, 'http://localhost:8895', win), false);
});

test('the tool route has its own prefix and never collides with a chapter', () => {
  assert.equal(href('tool', { bookId: 'japanese', toolId: 'reader' }), '#/tool/japanese/reader');
  assert.deepEqual(parse('#/tool/japanese/reader'), { name: 'tool', params: { bookId: 'japanese', toolId: 'reader' } });
  assert.deepEqual(parse('#/tool/japanese'), { name: 'tool', params: { bookId: 'japanese', toolId: null } });
  assert.deepEqual(parse('#/b/japanese/tool'), { name: 'chapter', params: { bookId: 'japanese', chapterId: 'tool' } });
  assert.deepEqual(parse('#/tool'), { name: 'catalog', params: {} });
});
