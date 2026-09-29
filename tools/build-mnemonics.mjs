#!/usr/bin/env node
/**
 * The kana memory hints, data/kana/mnemonics.json (neo-data/1).
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. Run it by hand after editing the
 * authored text in tools/lib/mnemonics-content.mjs, and commit the output:
 *
 *   node tools/build-mnemonics.mjs
 *
 * The keywords, stories and tells are written for this Book and live in the
 * content module; the kana, romaji, row and id of every record are copied
 * from data/kana/hiragana.json and katakana.json here, so no kana in the
 * output was typed by hand. A new keyword is checked for collisions against
 * published mnemonic sets (Tofugu's guides, the Japan Foundation Memory Hint
 * worksheets) before it lands: those are read, never copied, and never kept
 * in this repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { H, K, RULES } from './lib/mnemonics-content.mjs';

const ROOT = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const hira = read('data/kana/hiragana.json');
const kata = read('data/kana/katakana.json');

function keyOf(e) {
  if (e.id === 'kana:を' || e.id === 'kana:ヲ') return 'wo';
  return e.romaji;
}

/** romaji key -> glyph, per script, over the basic rows, dakuten, yoon and two marks. */
function lookup(doc) {
  const map = new Map();
  const put = (k, g) => { if (!map.has(k)) map.set(k, g); };
  for (const r of doc.row_order) for (const e of doc.rows[r]) put(keyOf(e), e.glyph);
  for (const r of doc.dakuten_order || []) for (const e of doc.dakuten[r]) put(e.romaji, e.glyph);
  for (const e of doc.yoon || []) put(e.romaji, e.glyph);
  if (doc.sokuon) put('sokuon', doc.sokuon.glyph);
  if (doc.chouonpu) put('chouon', doc.chouonpu.glyph);
  return map;
}
const LOOK = { h: lookup(hira), k: lookup(kata) };

const missing = [];
function fill(text, where) {
  return text.replace(/\{([hk]):([a-z0-9]+)\}/g, (whole, s, k) => {
    const g = LOOK[s].get(k);
    if (!g) { missing.push(`${where}: ${whole}`); return whole; }
    return g;
  });
}
const glyphOf = (ref, where) => {
  const [s, k] = ref.split('.');
  const g = LOOK[s].get(k);
  if (!g) missing.push(`${where}: contrast ${ref}`);
  return g;
};

function records(doc, content, script) {
  const out = {};
  const order = [];
  for (const r of doc.row_order) {
    for (const e of doc.rows[r]) {
      const key = keyOf(e);
      const c = content[key];
      if (!c) { missing.push(`${script}.${key}: no content`); continue; }
      const where = `${script}.${key}`;
      const rec = {
        id: e.id,
        kana: e.glyph,
        romaji: e.romaji,
        row: r,
        keyword: { en: c.kw[0], es: c.kw[1] },
        story: { en: fill(c.story[0], where), es: fill(c.story[1], where) },
        emoji: c.emoji,
        contrast: c.contrast.map(([ref, en, es]) => ({
          kana: glyphOf(ref, where),
          tell: { en: fill(en, where), es: fill(es, where) },
        })),
        checked_against: ['tofugu', 'jf-memory-hint'],
        // A record rewritten after the first pass carries its own date.
        checked_at: c.checked_at || '2026-09-28',
      };
      out[e.id] = rec;
      order.push(e.id);
    }
  }
  return { out, order };
}

const h = records(hira, H, 'h');
const k = records(kata, K, 'k');
const rules = {};
for (const [id, r] of Object.entries(RULES)) {
  rules[id] = {
    title: { en: r.title[0], es: r.title[1] },
    rule: { en: fill(r.rule[0], `rules.${id}`), es: fill(r.rule[1], `rules.${id}`) },
    mnemonic: { en: r.mnemonic[0], es: r.mnemonic[1] },
  };
}

if (missing.length) {
  console.error('unresolved:\n  ' + missing.join('\n  '));
  process.exit(1);
}

const doc = {
  _licence: {
    source: 'Written for the Runcible Japanese Book: original keywords, stories and rule mnemonics. No mnemonic set was copied or adapted.',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    spdx: 'CC0-1.0',
    derived: false,
    id: 'authored',
    acknowledgement: null,
    links: ['https://creativecommons.org/publicdomain/zero/1.0/'],
    screen: 'none',
    generated_by: 'authored by the kana hints stream of the runcible integrate-and-teach campaign, 2026-09-28. The kana, romaji, row and id of every record are copied from data/kana/hiragana.json and data/kana/katakana.json by the authoring script, and every kana in the file was checked against its Unicode character name. Each keyword and picture idea was checked for collisions against the Tofugu hiragana and katakana guides and the Japan Foundation Memory Hint worksheets, which were read as research and are not copied here. Revised 2026-09-29: the keyword for nu in both scripts was a noose, which read as grim, and is now nucleus (hiragana) and numeral (katakana), checked against the same sources in the same way; the tell of hiragana me against nu was reworded to match.',
    generated_at: '2026-09-29',
    note: 'Original to this project and dedicated to the public domain under CC0 1.0, which is why screen is none. An emoji is a character drawn by the reader\'s own font, and no image ships. The stroke descriptions follow the stroke order of data/kanji/strokes-kana.json (KanjiVG), but no path from it is copied here.',
  },
  format: 'neo-data/1',
  id: 'kana-mnemonics',
  title: { en: 'Kana memory hints', es: 'Pistas de memoria para el kana' },
  fields: {
    id: 'the id of the same kana in data/kana/hiragana.json or katakana.json, which is also the itemId an attempt carries',
    keyword: 'a word whose first syllable, said naturally in that language, is the sound of the kana',
    story: 'one or two lines that place every stroke in the taught order and name what separates the kana from its look-alike',
    emoji: 'the picture of the keyword, one emoji drawn by the reader\'s font',
    contrast: 'look-alikes: the kana and the tell that separates them. A look-alike with the same sound is a hint, never a quiz distractor',
    rules: 'one rule mnemonic each for the marks and the small kana, which have no picture of their own',
  },
  order: { hiragana: h.order, katakana: k.order },
  hiragana: h.out,
  katakana: k.out,
  rules,
};

// One record per line keeps the file reviewable and small.
function render(d) {
  const lines = ['{'];
  const top = Object.keys(d);
  top.forEach((key, i) => {
    const last = i === top.length - 1;
    const v = d[key];
    if (key === 'hiragana' || key === 'katakana' || key === 'rules') {
      lines.push(`  ${JSON.stringify(key)}: {`);
      const ks = Object.keys(v);
      ks.forEach((id, j) => lines.push(`    ${JSON.stringify(id)}: ${JSON.stringify(v[id])}${j === ks.length - 1 ? '' : ','}`));
      lines.push(`  }${last ? '' : ','}`);
    } else {
      const body = JSON.stringify(v, null, 2).split('\n').map((l, n) => (n ? `  ${l}` : l)).join('\n');
      lines.push(`  ${JSON.stringify(key)}: ${body}${last ? '' : ','}`);
    }
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}

const outPath = path.join(ROOT, 'data/kana/mnemonics.json');
fs.writeFileSync(outPath, render(doc));
console.log(`wrote ${outPath}: ${h.order.length} hiragana, ${k.order.length} katakana, ${Object.keys(rules).length} rules, ${fs.statSync(outPath).size} bytes`);
