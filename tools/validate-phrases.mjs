#!/usr/bin/env node
/**
 * validate-phrases.mjs
 *
 * The gate on the one authored file in the Japanese Book's corpus,
 * data/phrases/ch14.json: the sentence patterns and the two-turn exchanges the
 * `14-phrases` pages show as prose. Nothing here is ever scored, and the plan
 * that commissioned it is explicit about why it still needs a gate: an
 * authored line is the one place a word the Book has not taught can enter, and
 * a page that teaches vocabulary nobody declared is invented content wearing a
 * corpus's clothes.
 *
 *   node tools/validate-phrases.mjs                    # data/phrases/*.json
 *   node tools/validate-phrases.mjs path/to/x.json     # a named file
 *
 * It exits 0, or it exits 1 and names the file, the row and the field. Nothing
 * runs it for you until it is wired into `make validate`; running it is part of
 * the definition of done for any change under data/phrases/.
 *
 * ONE VALIDATOR PER SCHEMA. This one owns neo-phrases/1 and nothing else. The
 * licence block belongs to check-licence.mjs, the derived corpus formats to
 * validate-corpus.mjs, and the chapter that points at this file to
 * validate-book.mjs.
 *
 * HOW "every content word is checked" IS MADE TRUE WITHOUT A TOKENIZER.
 * There is no Japanese tokenizer in this repo and the plan puts one out of
 * scope, so the file carries its own segmentation and its own claims, and this
 * file checks that the two agree:
 *
 *   1. `kana` is the line in kana with its pieces separated by spaces, the same
 *      wakachigaki the song lines use.
 *   2. `words` names the vocabulary headwords the row uses. Each one has to be
 *      a headword of a file the document declares in `vocabulary`, and its kana
 *      has to be one of the pieces, so the claim cannot be decorative.
 *   3. Every remaining piece has to be an entry of the document's own
 *      `grammar` block, which is capped and every entry of which has to be
 *      used. That is the closed class, declared once, glossed in both
 *      languages, in the file rather than in this validator.
 *
 * A content word can therefore only reach a page by being in a corpus slice or
 * by being written into `grammar`, where it is one short list away from any
 * reader.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SITE, EM_DASH, EN_DASH, walkStrings } from './lib/corpus.mjs';

const FORMAT = 'neo-phrases/1';
const REGISTERS = new Set(['plain', 'polite', 'short']);
const ROW_ID = /^[a-z][a-z0-9-]*$/;
/** The frame's slot, the string a filler replaces. */
const SLOT = '[ ]';
/** A closed class stays small, or it is not a closed class any more. */
const GRAMMAR_CAP = 24;
/** C11.6 caps every JSON file at 150 KB; an authored page file is far under. */
const BUDGET_KB = 40;

const problems = [];
function fail(where, message) { problems.push(`${where}: ${message}`); }

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

function checkBilingual(where, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(where, 'must be an { en, es } object'); return;
  }
  for (const key of ['en', 'es']) {
    if (!isStr(value[key])) fail(`${where}.${key}`, 'is required and must be a non-empty string');
  }
  for (const key of Object.keys(value)) {
    if (key !== 'en' && key !== 'es') fail(`${where}.${key}`, 'is not a language key, only en and es exist');
  }
}

/** word -> { kana, src } over every vocabulary slice the document declares. */
function readVocabulary(rel, doc) {
  const words = new Map();
  if (!Array.isArray(doc.vocabulary) || doc.vocabulary.length === 0) {
    fail(`${rel}.vocabulary`, 'must list the vocabulary slices these lines draw on');
    return words;
  }
  for (const src of doc.vocabulary) {
    if (!isStr(src) || !src.startsWith('data/')) { fail(`${rel}.vocabulary`, `${src} is not a data/ path`); continue; }
    const abs = path.join(SITE, src);
    if (!fs.existsSync(abs)) { fail(`${rel}.vocabulary`, `${src} is not on disk`); continue; }
    const slice = JSON.parse(fs.readFileSync(abs, 'utf8'));
    for (const group of slice.order || []) {
      for (const w of slice.groups[group] || []) {
        if (!words.has(w.word)) words.set(w.word, { kana: w.kana || w.word, src });
      }
    }
  }
  return words;
}

/**
 * One row, whatever block it came from. `kind` decides which of frame, slot
 * and turn the row must carry; everything else is the same everywhere, and
 * every field a page can put in a table cell is a string, because
 * js/render-pages.js stringifies a cell and an { en, es } object prints as
 * [object Object].
 */
function checkRow(where, row, kind, ctx) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) { fail(where, 'must be an object'); return; }

  const required = ['id', 'register', 'kana', 'en', 'es', 'words'];
  if (kind === 'pattern') required.push('frame', 'slot');
  if (kind === 'exchange') required.push('turn');
  const allowed = new Set(required);
  for (const key of Object.keys(row)) {
    if (!allowed.has(key)) fail(`${where}.${key}`, `is not a field of a ${kind} row`);
    else if (typeof row[key] !== 'string') fail(`${where}.${key}`, 'must be a string; a table cell stringifies whatever it is handed');
  }
  for (const key of required) if (!isStr(row[key])) fail(`${where}.${key}`, 'is required');
  if (problems.length && !isStr(row.kana)) return;

  if (!ROW_ID.test(row.id || '')) fail(`${where}.id`, `"${row.id}" is not a slug`);
  if (ctx.ids.has(row.id)) fail(`${where}.id`, `duplicates ${row.id}`);
  ctx.ids.add(row.id);
  if (!REGISTERS.has(row.register)) {
    fail(`${where}.register`, `"${row.register}" is not one of ${[...REGISTERS].join(', ')}`);
  }

  // The frame and the line have to be the same sentence, or the page shows a
  // pattern its own examples do not follow.
  if (kind === 'pattern') {
    if (!String(row.frame).includes(SLOT)) fail(`${where}.frame`, `must carry the slot ${SLOT}`);
    else if (row.frame.split(SLOT).join(row.slot) !== row.kana) {
      fail(`${where}.kana`, `is "${row.kana}", but the frame with ${row.slot} in its slot is "${row.frame.split(SLOT).join(row.slot)}"`);
    }
    if (!row.kana.split(' ').includes(row.slot)) fail(`${where}.slot`, `"${row.slot}" is not one piece of the line`);
  }

  // The declared words, and then the pieces they do not account for.
  const pieces = row.kana.split(' ').filter(Boolean);
  const spoken = new Set(pieces);
  const accounted = new Set();
  for (const token of row.words.split(' ').filter(Boolean)) {
    const entry = ctx.vocab.get(token);
    if (!entry) {
      fail(`${where}.words`, `"${token}" is not a headword of any file this document declares in vocabulary`);
      continue;
    }
    if (!spoken.has(entry.kana)) {
      fail(`${where}.words`, `"${token}" reads ${entry.kana}, which is not one of the pieces of "${row.kana}"`);
      continue;
    }
    accounted.add(entry.kana);
    ctx.used.get(entry.src).add(token);
  }
  for (const piece of pieces) {
    if (accounted.has(piece)) continue;
    if (ctx.grammar.has(piece)) { ctx.grammarUsed.add(piece); continue; }
    fail(`${where}.kana`, `"${piece}" is neither a declared word of this row nor an entry of grammar[]`);
  }
}

function checkBlock(rel, doc, key, kind, ctx, { turns = 0 } = {}) {
  const block = doc[key];
  if (!block || typeof block !== 'object' || Array.isArray(block)) { fail(`${rel}.${key}`, 'must be an object keyed by situation'); return; }
  for (const situation of Object.keys(block)) {
    if (!doc.order.includes(situation)) fail(`${rel}.${key}.${situation}`, 'is not one of the situations in order[]');
    const rows = block[situation];
    if (!Array.isArray(rows) || rows.length === 0) { fail(`${rel}.${key}.${situation}`, 'must be a non-empty array of rows'); continue; }
    if (turns && rows.length !== turns) fail(`${rel}.${key}.${situation}`, `has ${rows.length} turns; an exchange is ${turns}`);
    rows.forEach((row, i) => checkRow(`${rel}.${key}.${situation}[${i}]`, row, kind, ctx));
    if (kind === 'exchange') {
      const want = ['A', 'B'];
      rows.forEach((row, i) => {
        if (i >= want.length || !row) return;
        if (row.turn !== want[i]) fail(`${rel}.${key}.${situation}[${i}].turn`, `must be ${want[i]}, so the two turns read in order`);
      });
    }
    if (kind === 'pattern') {
      if (rows.length < 3) fail(`${rel}.${key}.${situation}`, `has ${rows.length} fillers; a pattern is one slot and three of them`);
      const frames = new Set(rows.map((r) => r && r.frame));
      if (frames.size > 1) fail(`${rel}.${key}.${situation}`, `carries ${frames.size} frames; one situation is one pattern`);
    }
  }
}

function checkDoc(rel, doc) {
  if (doc.format !== FORMAT) { fail(`${rel}.format`, `must be "${FORMAT}", found ${JSON.stringify(doc.format)}`); return; }
  const lic = doc._licence || {};
  if (lic.spdx !== 'CC0-1.0') fail(`${rel}._licence.spdx`, 'must be CC0-1.0: this file is authored, not derived');
  if (lic.derived !== false) fail(`${rel}._licence.derived`, 'must be false');
  if (lic.screen !== 'none') fail(`${rel}._licence.screen`, 'must be "none": there is no upstream to acknowledge');
  if (!isStr(doc.chapter)) fail(`${rel}.chapter`, 'must name the chapter these pages belong to');
  checkBilingual(`${rel}.title`, doc.title);
  // The disclosure the plan requires on the page, kept with the data so the
  // page cannot render the exchanges without it.
  checkBilingual(`${rel}.note`, doc.note);
  if (!Array.isArray(doc.order) || doc.order.length === 0) { fail(`${rel}.order`, 'must list the situations'); return; }

  const vocab = readVocabulary(rel, doc);
  const grammar = new Map();
  if (!Array.isArray(doc.grammar)) fail(`${rel}.grammar`, 'must be an array of closed-class pieces');
  else {
    if (doc.grammar.length > GRAMMAR_CAP) {
      fail(`${rel}.grammar`, `has ${doc.grammar.length} entries, over the cap of ${GRAMMAR_CAP}. A list this long is vocabulary, and vocabulary belongs in a corpus slice`);
    }
    doc.grammar.forEach((g, i) => {
      const at = `${rel}.grammar[${i}]`;
      if (!g || typeof g !== 'object') { fail(at, 'must be an object'); return; }
      if (!isStr(g.piece)) fail(`${at}.piece`, 'is required');
      else if (grammar.has(g.piece)) fail(`${at}.piece`, `duplicates ${g.piece}`);
      else grammar.set(g.piece, g);
      for (const key of ['en', 'es']) if (!isStr(g[key])) fail(`${at}.${key}`, 'is required: a closed-class piece is glossed in both languages');
      if (vocab.has(g.piece)) fail(`${at}.piece`, `"${g.piece}" is already a headword in ${vocab.get(g.piece).src}; declare it in a row's words instead`);
    });
  }

  const ctx = {
    vocab, grammar, ids: new Set(), grammarUsed: new Set(),
    used: new Map((doc.vocabulary || []).map((src) => [src, new Set()])),
  };
  checkBlock(rel, doc, 'patterns', 'pattern', ctx);
  checkBlock(rel, doc, 'registers', 'register', ctx);
  checkBlock(rel, doc, 'exchanges', 'exchange', ctx, { turns: 2 });

  for (const situation of doc.order) {
    for (const key of ['patterns', 'exchanges']) {
      if (!doc[key] || !doc[key][situation]) fail(`${rel}.${key}.${situation}`, 'is missing, and order[] names the situation');
    }
  }
  for (const piece of grammar.keys()) {
    if (!ctx.grammarUsed.has(piece)) fail(`${rel}.grammar`, `"${piece}" is declared and no line uses it`);
  }
  for (const [src, used] of ctx.used) {
    if (used.size === 0) fail(`${rel}.vocabulary`, `${src} is declared and no line draws a word from it`);
  }
  return ctx;
}

function main() {
  const args = process.argv.slice(2);
  const dir = path.join(SITE, 'data', 'phrases');
  const files = args.length
    ? args.map((a) => path.resolve(process.cwd(), a))
    : (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort().map((n) => path.join(dir, n)) : []);
  if (!files.length) { process.stdout.write('no phrase documents found under data/phrases\n'); return; }

  for (const file of files) {
    // A file the caller named from somewhere else is reported by its own name
    // rather than by a relative path made of a dozen parent segments.
    const inside = path.relative(SITE, file);
    const rel = inside.startsWith('..') ? path.basename(file) : inside;
    const raw = fs.readFileSync(file);
    let doc;
    try { doc = JSON.parse(raw.toString('utf8')); } catch (err) { fail(rel, `does not parse: ${err.message}`); continue; }

    for (const [at, s] of walkStrings(doc, rel)) {
      if (s.includes(EM_DASH) || s.includes(EN_DASH)) fail(at, 'carries a dash the house rule bans');
      if (/<[A-Za-z/!]/.test(s)) fail(at, 'carries markup, and no content field may');
    }
    if (raw.length > BUDGET_KB * 1024) fail(rel, `is ${(raw.length / 1024).toFixed(1)} KB, over the ${BUDGET_KB} KB budget`);

    const ctx = checkDoc(rel, doc);
    const rows = ctx ? ctx.ids.size : 0;
    const sources = ctx ? [...ctx.used].map(([src, used]) => `${path.basename(src)} ${used.size}`).join(', ') : '';
    process.stdout.write(`${rel}: ${rows} rows, ${(doc.order || []).length} situations, ${(doc.grammar || []).length} grammar pieces, headwords by source: ${sources}\n`);
  }

  if (problems.length) {
    process.stderr.write(`\n${problems.length} problems:\n`);
    for (const p of problems) process.stderr.write(`  ${p}\n`);
    process.exit(1);
  }
  process.stdout.write('phrases ok\n');
}

main();
