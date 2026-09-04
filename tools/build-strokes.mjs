#!/usr/bin/env node
/**
 * data/kanji/strokes-<set>.json, derived from KanjiVG.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 * Run it by hand, commit the output, never wire it into CI or `make serve`:
 *
 *   node tools/build-strokes.mjs
 *
 * KanjiVG ships 6,702 SVG files and a 12.6 MB archive. None of that is shipped.
 * What ships is the ordered stroke path data and the stroke number positions,
 * which is 12 percent of each SVG; the other 88 percent is the licence header
 * and the SVG 1.0 DTD block, repeated once per character.
 *
 * The animation is ours (about 30 lines of stroke-dasharray in the shell, per
 * DESIGN Q5), which is the cost accepted for a single-licence feature: one
 * CC BY-SA 3.0 grant covers kana and kanji alike, where animCJK would put LGPL
 * and Arphic inside the same feature.
 *
 * KanjiVG's licence asks for attribution "in your own copyright header". That
 * header is the `_licence` block of every file this emits, quoted exactly, and
 * `screen: "required"` is what makes the shell render it wherever a stroke
 * diagram appears.
 *
 * Layout: characters sit at the top level of the document so that CONTRACTS
 * C3.2's bare-key pointer (`strokes-kana.json#あ`) resolves directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadKanjiVgDir, SOURCES } from './lib/sources.mjs';
import { SITE, licenceBlock, writeData } from './lib/corpus.mjs';
import { kanjiSelection, resolveSet, kanaLiterals } from './lib/kanjisets.mjs';

const TOOL = 'tools/build-strokes.mjs';
const PATH_D = /<path\s[^>]*\bd="([^"]+)"/g;
const NUMBER_AT = /<text\s+transform="matrix\(1 0 0 1 ([\d.-]+) ([\d.-]+)\)">(\d+)<\/text>/g;
const VIEWBOX = /<svg[^>]*\bviewBox="([^"]+)"/;

function svgFile(dir, char) {
  const cp = char.codePointAt(0).toString(16).padStart(5, '0');
  return path.join(dir, `${cp}.svg`);
}

function parseSvg(text) {
  const strokes = [];
  PATH_D.lastIndex = 0;
  let m = PATH_D.exec(text);
  while (m) { strokes.push(m[1]); m = PATH_D.exec(text); }

  const numbers = [];
  NUMBER_AT.lastIndex = 0;
  let n = NUMBER_AT.exec(text);
  while (n) { numbers.push([Number(n[1]), Number(n[2])]); n = NUMBER_AT.exec(text); }

  const box = VIEWBOX.exec(text);
  return { strokes, numbers, viewBox: box ? box[1] : null };
}

function buildSet(dir, id, chapter, title, literals, budgetKb, outFile) {
  const doc = {
    _licence: licenceBlock('kanjivg', TOOL, {
      upstream: `${SOURCES.kanjivg.name} ${SOURCES.kanjivg.release}`,
    }),
    format: 'neo-strokes/1',
    set: id,
    chapter,
    title,
    viewBox: '0 0 109 109',
    order: literals,
    count: literals.length,
  };
  const missing = [];
  let boxes = new Set();
  for (const char of literals) {
    const file = svgFile(dir, char);
    if (!fs.existsSync(file)) { missing.push(char); continue; }
    const { strokes, numbers, viewBox } = parseSvg(fs.readFileSync(file, 'utf8'));
    if (!strokes.length) { missing.push(`${char} (no path data)`); continue; }
    if (viewBox) boxes.add(viewBox);
    const entry = { n: strokes.length, s: strokes };
    if (numbers.length === strokes.length) entry.at = numbers;
    doc[char] = entry;
  }
  if (boxes.size === 1) [doc.viewBox] = [...boxes];
  else if (boxes.size > 1) {
    process.stderr.write(`  ${id}: ${boxes.size} different viewBox values, ${[...boxes].join(' | ')}\n`);
    process.exitCode = 1;
  }
  const bytes = writeData(path.join(SITE, 'data', ...outFile.split('/')), doc, budgetKb);
  if (missing.length) {
    process.stderr.write(`  ${id}: ${missing.length} characters not in KanjiVG: ${missing.join(' ')}\n`);
    process.exitCode = 1;
  }
  return bytes;
}

function main() {
  const dir = loadKanjiVgDir();
  const sel = kanjiSelection();

  for (const set of sel.sets) {
    buildSet(dir, set.id, set.chapter, set.title, resolveSet(set),
      set.strokes_budget_kb || set.budget_kb, set.out || `kanji/strokes-${set.id}.json`);
  }

  const kana = sel.kana_set;
  const literals = kanaLiterals(kana);
  if (literals.length !== 176) {
    process.stderr.write(`kana ranges give ${literals.length} codepoints, expected 176\n`);
    process.exitCode = 1;
  }
  // The research report HEAD-checked 176 of 176 kana against KanjiVG. Re-check
  // it here on every run rather than trusting a number in a document: a missing
  // kana is a chapter 1 stroke exercise with a hole in it.
  const present = literals.filter((c) => fs.existsSync(svgFile(dir, c)));
  process.stdout.write(`kana coverage ${present.length}/${literals.length} in KanjiVG ${SOURCES.kanjivg.release}\n`);
  buildSet(dir, kana.id, kana.chapter, kana.title, [...literals, ...(kana.extra || [])],
    kana.budget_kb, kana.out || 'kanji/strokes-kana.json');
}

main();
