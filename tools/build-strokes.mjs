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
 *
 * That layout is also why each file carries a `list[]` beside the map. A record
 * is keyed by its glyph, so the glyph is a key and not a field, and an exercise
 * spec names a field: `prompt: "glyph"` has nothing to read. The list is the
 * same records flattened to `{ id, glyph, n }`, which is what a stroke-count
 * drill needs and what `strokes-kana.json#list` points at. It is derived in one
 * loop from the map it sits beside, so the two cannot disagree.
 *
 * Two fields come out of the SVG besides the paths: `radical`, the element
 * KanjiVG marks as the character's radical, and `phon`, the element it marks as
 * carrying the sound. Both are already in the file being parsed, both are
 * facts about the character rather than about the drawing, and `phon` is the
 * per-character half of what tools/build-phon.mjs measures across the joyo.
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
const GROUP = /<g\b[^>]*>/g;
const ATTR = (name) => new RegExp(`kvg:${name}="([^"]+)"`);

/**
 * One character is emitted as a \uXXXX escape rather than as itself, and the
 * reason is in tools/lib/corpus.mjs beside `escapeChars`: check-licence.mjs
 * bans it outright because a 1941 song's whole title is that single character,
 * and KANJIDIC puts the same character in grade 2. It is written here as an
 * escape too, so this file does not spell it out either.
 */
const ESCAPE = ['\u6d77'];

function svgFile(dir, char) {
  const cp = char.codePointAt(0).toString(16).padStart(5, '0');
  return path.join(dir, `${cp}.svg`);
}

/**
 * The element of the group KanjiVG marks as the radical, and the element it
 * marks as the phonetic. The general radical is preferred over the traditional
 * one because that is the classification a modern dictionary indexes by. A
 * numbered phonetic (the metal character carries the same component twice, once
 * per variant shape) is reduced to the component itself: the number describes
 * the drawing, not the sound. tools/build-phon.mjs strips it the same way, and
 * a group whose members disagreed with their own stroke file about what their
 * phonetic is would be a group nobody could check.
 */
function parseParts(text) {
  const out = {};
  let tradit = null;
  GROUP.lastIndex = 0;
  let g = GROUP.exec(text);
  while (g) {
    const tag = g[0];
    const element = ATTR('element').exec(tag);
    if (element) {
      const radical = ATTR('radical').exec(tag);
      if (radical && radical[1] === 'general' && !out.radical) [, out.radical] = element;
      if (radical && radical[1] === 'tradit' && !tradit) [, tradit] = element;
    }
    const phon = ATTR('phon').exec(tag);
    if (phon && !out.phon) out.phon = phon[1].replace(/[0-9VT]+$/, '') || phon[1];
    g = GROUP.exec(text);
  }
  if (!out.radical && tradit) out.radical = tradit;
  return out;
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
  return { strokes, numbers, viewBox: box ? box[1] : null, ...parseParts(text) };
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
  const list = [];
  const boxes = new Set();
  for (const char of literals) {
    const file = svgFile(dir, char);
    if (!fs.existsSync(file)) { missing.push(char); continue; }
    const {
      strokes, numbers, viewBox, radical, phon,
    } = parseSvg(fs.readFileSync(file, 'utf8'));
    if (!strokes.length) { missing.push(`${char} (no path data)`); continue; }
    if (viewBox) boxes.add(viewBox);
    const entry = { n: strokes.length, s: strokes };
    if (numbers.length === strokes.length) entry.at = numbers;
    if (radical) entry.radical = radical;
    if (phon) entry.phon = phon;
    doc[char] = entry;
    list.push({
      id: `s_${char.codePointAt(0).toString(16)}`, glyph: char, n: strokes.length,
    });
  }
  doc.list = list;
  if (boxes.size === 1) [doc.viewBox] = [...boxes];
  else if (boxes.size > 1) {
    process.stderr.write(`  ${id}: ${boxes.size} different viewBox values, ${[...boxes].join(' | ')}\n`);
    process.exitCode = 1;
  }
  const bytes = writeData(path.join(SITE, 'data', ...outFile.split('/')), doc, budgetKb, ESCAPE);
  if (missing.length) {
    process.stderr.write(`  ${id}: ${missing.length} characters not in KanjiVG: ${missing.join(' ')}\n`);
    process.exitCode = 1;
  }
  return bytes;
}

function main() {
  const dir = loadKanjiVgDir();
  const sel = kanjiSelection();

  // Coverage is re-counted per set on every run rather than trusted to a number
  // in a document. A set whose file is one character short is a rung with a hole
  // in it, and the hole is invisible until a learner reaches that character.
  for (const set of sel.sets) {
    const literals = resolveSet(set);
    const present = literals.filter((c) => fs.existsSync(svgFile(dir, c)));
    process.stdout.write(
      `${set.id} coverage ${present.length}/${literals.length} in KanjiVG ${SOURCES.kanjivg.release}\n`);
    buildSet(dir, set.id, set.chapter, set.title, literals,
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
