#!/usr/bin/env node
/**
 * The corpus validator. Exits 0, or exits 1 and names the file, the record and
 * the field. Nothing runs it for you.
 *
 *   node tools/validate-corpus.mjs
 *
 * Running it is part of the definition of done for any change under data/ or
 * under a book's decks directory, which is the discipline aficion-site set in its own
 * data/README.md and the reason its corpus never shipped a broken record.
 *
 * ONE VALIDATOR PER SCHEMA. This one owns the derived corpus formats
 * (neo-vocab/1, neo-kanji/1, neo-strokes/1, neo-sentences/1) plus the two
 * rules that cut across every JSON file in the project: the C11.6 size budget
 * and the house dash rule inside string values.
 *
 * It deliberately does NOT own:
 *   - the `_licence` presence and banned-song gate: tools/check-licence.mjs
 *   - the neo-deck/1 and neo-ledger/1 schemas: rappel-site/tools/validate-deck.mjs
 *   - the neo-book/1 and neo-chapter/1 schemas: tools/validate-book.mjs
 * A second definition of valid is how two definitions of valid appear. What it
 * does check on a deck is the one invariant its own generator could break:
 * that `noteId + ":" + templateId` is unique and stable, because that string is
 * the review ledger's foreign key and a collision silently merges two people's
 * cards into one.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  SITE, RAPPEL, LICENCES, walkStrings, EM_DASH, EN_DASH,
} from './lib/corpus.mjs';

const MAX_BYTES = 150 * 1024;

const problems = [];
const seen = { files: 0, records: 0 };

function fail(file, what) { problems.push(`${file}: ${what}`); }

function jsonFiles(root, ...parts) {
  const dir = path.join(root, ...parts);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsonFiles(p));
    else if (entry.name.endsWith('.json')) out.push(p);
  }
  return out;
}

function rel(file) {
  return path.relative(path.dirname(SITE), file);
}

function checkCommon(file, doc, bytes) {
  if (bytes > MAX_BYTES) {
    fail(rel(file), `${(bytes / 1024).toFixed(1)} KB is over the 150 KB cap in C11.6`);
  }
  for (const [at, s] of walkStrings(doc)) {
    if (s.includes(EM_DASH)) fail(rel(file), `em dash in a string value at ${at}`);
    else if (s.includes(EN_DASH)) fail(rel(file), `en dash in a string value at ${at}`);
  }
  // A file this project generated states which licence it inherited. If the
  // wording drifted from the canonical text, the acknowledgement renders and
  // is still a licence breach, which is the failure mode nothing else catches.
  const l = doc._licence;
  if (l && l.id && LICENCES[l.id] && l.derived !== false) {
    const want = LICENCES[l.id].acknowledgement;
    if (l.acknowledgement !== want) {
      fail(rel(file), `_licence.acknowledgement does not match the required ${l.id} wording`);
    }
    if (l.spdx !== LICENCES[l.id].spdx) {
      fail(rel(file), `_licence.spdx is ${l.spdx}, expected ${LICENCES[l.id].spdx}`);
    }
  }
}

function checkGrouped(file, doc, itemCheck) {
  if (!Array.isArray(doc.order)) return fail(rel(file), 'no order array');
  let n = 0;
  const ids = new Set();
  for (const groupId of doc.order) {
    const items = doc.groups?.[groupId];
    if (!Array.isArray(items)) { fail(rel(file), `order names ${groupId}, groups does not`); continue; }
    for (const item of items) {
      if (!item.id) fail(rel(file), `an item in ${groupId} has no id`);
      else if (ids.has(item.id)) fail(rel(file), `duplicate item id ${item.id}`);
      ids.add(item.id);
      itemCheck(file, groupId, item);
      n += 1;
    }
  }
  if (doc.count !== n) fail(rel(file), `count says ${doc.count}, found ${n}`);
  seen.records += n;
  return undefined;
}

function checkVocab(file, doc) {
  checkGrouped(file, doc, (f, groupId, item) => {
    if (!item.word) fail(rel(f), `${item.id} has no word`);
    if (!item.kana) fail(rel(f), `${item.id} (${item.word}) has no kana reading`);
    if (!Array.isArray(item.gloss) || !item.gloss.length) fail(rel(f), `${item.id} (${item.word}) has no gloss`);
    if (!item.jmdict) fail(rel(f), `${item.id} (${item.word}) has no JMdict id`);
  });
}

function checkSentences(file, doc) {
  checkGrouped(file, doc, (f, groupId, item) => {
    if (!item.ja) fail(rel(f), `${item.id} has no Japanese`);
    if (!item.en) fail(rel(f), `${item.id} has no English`);
    if (!Array.isArray(item.tatoeba) || item.tatoeba.length !== 2) {
      fail(rel(f), `${item.id} has no Tatoeba id pair, so the sentence cannot be traced`);
    }
    if (item.word && !item.ja.includes(item.word)) {
      fail(rel(f), `${item.id} claims to teach ${item.word}, which is not in the sentence`);
    }
  });
}

function checkKanji(file, doc) {
  if (!Array.isArray(doc.order)) return fail(rel(file), 'no order array');
  for (const lit of doc.order) {
    const e = doc[lit];
    if (!e) { fail(rel(file), `order names ${lit}, the document has no entry for it`); continue; }
    if (!e.strokes) fail(rel(file), `${lit} has no stroke count`);
    if (!e.meanings?.length) fail(rel(file), `${lit} has no English meaning`);
    if (!e.on?.length && !e.kun?.length) fail(rel(file), `${lit} has neither on nor kun reading`);
    seen.records += 1;
  }
  if (doc.count !== doc.order.length) fail(rel(file), `count says ${doc.count}, order has ${doc.order.length}`);
  return undefined;
}

function checkStrokes(file, doc) {
  if (!Array.isArray(doc.order)) return fail(rel(file), 'no order array');
  if (!doc.viewBox) fail(rel(file), 'no viewBox, so nothing can render these paths');
  for (const lit of doc.order) {
    const e = doc[lit];
    if (!e) { fail(rel(file), `order names ${lit}, the document has no stroke data for it`); continue; }
    if (!Array.isArray(e.s) || !e.s.length) fail(rel(file), `${lit} has no stroke paths`);
    else if (e.n !== e.s.length) fail(rel(file), `${lit} says ${e.n} strokes, carries ${e.s.length}`);
    if (e.at && e.at.length !== e.s.length) {
      fail(rel(file), `${lit} has ${e.at.length} stroke number positions for ${e.s.length} strokes`);
    }
    seen.records += 1;
  }
  return undefined;
}

/** The generator self-check described in the header. Not the deck schema. */
function checkDeckIdentity(file, doc) {
  const templateIds = new Set((doc.templates || []).map((t) => t.id));
  if (!templateIds.size) fail(rel(file), 'a deck with no templates has no cards');
  const fields = new Set(doc.fields || []);
  for (const t of doc.templates || []) {
    if (t.answer_field && !fields.has(t.answer_field)) {
      fail(rel(file), `template ${t.id} answers with field ${t.answer_field}, which the deck does not declare`);
    }
    for (const m of `${t.front || ''}${t.back || ''}`.matchAll(/\{\{(\w+)\}\}/g)) {
      if (!fields.has(m[1])) {
        fail(rel(file), `template ${t.id} renders {{${m[1]}}}, which the deck does not declare`);
      }
    }
    if (!t.skill) fail(rel(file), `template ${t.id} has no skill, so a review can never become evidence`);
    if (t.kind === 'cloze' && !fields.has(t.text_field)) {
      fail(rel(file), `cloze template ${t.id} has no text_field naming a declared field`);
    }
  }
  if (doc.media_base && (doc.media_base.includes('..') || /^[a-z]+:/i.test(doc.media_base))) {
    fail(rel(file), `media_base ${doc.media_base} is not a same-origin relative path`);
  }
  if (String(doc.licence).startsWith('CC-BY')) {
    if (!doc.attribution) fail(rel(file), `licence ${doc.licence} requires an attribution string`);
    if (doc.screen !== 'required') fail(rel(file), `licence ${doc.licence} requires screen: "required"`);
  }
  const cards = new Set();
  const noteIds = new Set();
  for (const note of doc.notes || []) {
    if (!note.id) { fail(rel(file), 'a note has no id'); continue; }
    if (typeof note.id !== 'string') fail(rel(file), `note id ${note.id} is not a string`);
    if (noteIds.has(note.id)) fail(rel(file), `duplicate note id ${note.id}`);
    noteIds.add(note.id);
    for (const t of note.templates || []) {
      if (!templateIds.has(t)) fail(rel(file), `note ${note.id} names template ${t}, which the deck does not define`);
      const card = `${note.id}:${t}`;
      if (cards.has(card)) fail(rel(file), `duplicate card identity ${card}, which would merge two cards in the ledger`);
      cards.add(card);
    }
    seen.records += 1;
  }
}

const BY_FORMAT = {
  'neo-vocab/1': checkVocab,
  'neo-kanji/1': checkKanji,
  'neo-strokes/1': checkStrokes,
  'neo-sentences/1': checkSentences,
  'neo-deck/1': checkDeckIdentity,
};

function main() {
  const files = [
    ...jsonFiles(SITE, 'data'),
    ...jsonFiles(SITE, 'books'),
    ...jsonFiles(RAPPEL, 'data'),
  ];
  const skipped = [];
  for (const file of files) {
    const raw = fs.readFileSync(file);
    let doc;
    try { doc = JSON.parse(raw.toString('utf8')); } catch (err) {
      fail(rel(file), `does not parse: ${err.message}`);
      continue;
    }
    seen.files += 1;
    checkCommon(file, doc, raw.length);
    const check = BY_FORMAT[doc.format];
    if (check) check(file, doc);
    else skipped.push(`${rel(file)} (${doc.format || 'no format field'})`);
  }

  process.stdout.write(`${seen.files} JSON files, ${seen.records} records\n`);
  if (skipped.length) {
    // Named by count, not one line each. Twenty song files scrolling past on
    // every run trains a person to stop reading the output of the gate.
    const kinds = [...new Set(skipped.map((s) => s.replace(/^.*\((.*)\)$/, '$1')))];
    process.stdout.write(
      `${skipped.length} belong to another validator (${kinds.join(', ')}), `
      + 'checked here for size and dashes only\n');
  }
  if (problems.length) {
    process.stderr.write(`\n${problems.length} problems:\n`);
    for (const p of problems) process.stderr.write(`  ${p}\n`);
    process.exit(1);
  }
  process.stdout.write('corpus ok\n');
}

main();
