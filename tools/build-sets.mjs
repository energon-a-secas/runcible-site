#!/usr/bin/env node
/**
 * Quiz sets, format neo-quiz-set/1 (quiz-site/llms.txt is the contract).
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 * Run it by hand, read the numbers, commit the output, never wire it into CI
 * or `make serve`:
 *
 *   node tools/build-sets.mjs
 *   cd ../quiz-site && node tools/validate-set.mjs   # the gate on what it wrote
 *
 * Writes each set twice, from one source, so the two copies cannot drift:
 *   ../quiz-site/data/sets/<id>.json        Quiz's own library, plus index.json
 *   books/japanese/sets/<id>.json           the copy a Runcible chapter embeds
 *
 * Four games: beats from data/loanwords (seed.json, with rules.json behind the
 * explain lines), sound from the two kana tables (one set per script, gojuon,
 * dakuten, yoon and the extended katakana digraphs, each item carrying its row
 * and column), pairs from the same tables (kana to romaji, row and column
 * carried too) and data/vocab/ch4.json (word to meaning, the reading never on
 * the board, the rung carried as group), order from data/songs (one set per
 * song, the pieces cut on the word boundaries the corpus's own romaji line
 * records, aligned back onto the kana; see songPieces). quiz-site/data/README.md
 * records what each set carries and what could not be derived.
 *
 * THE ONE RULE THAT MATTERS HERE. An item id is derived from the corpus id of
 * the record it came from, never from its position, so a re-run over the same
 * corpus emits the same ids. quiz:answer carries that id as itemId and
 * Runcible stores it as evidence; an id that moves between runs orphans every
 * attempt a person made on that item, and nothing would report it. The
 * transliteration below exists only to make those ids ASCII: change it and
 * every loanword id moves.
 *
 * Nothing here supplies Japanese or English of its own. A beat split is
 * mechanical from the katakana; the rule pointer and the explain line come
 * from the corpus (a word's own explain line first, then its rule's line from
 * rules.json), and where it has neither the item carries null. A beats romaji
 * is the corpus's own line when it has one and otherwise read off the kana
 * through the tables (see hepburn), macron style either way and never null;
 * the derived line is checked against every corpus line, so the fallback is
 * not a path nobody has run. The Spanish a corpus slice has none of, a first
 * words meaning and a song gloss, is written in tools/selection/sets.json
 * (meanings_es, glosses_es) and carried across as it stands: this file
 * translates nothing, and a record the selection does not name ships with
 * es null so the reader gets the English and the honesty line. Derived
 * data inherits its source's licence: JMdict-derived sets are CC BY-SA 4.0
 * with screen "required" in EDRDG's own words, the kana tables and the songs
 * are public domain, and a song set carries the authors' death years because
 * they are the whole basis of the verdict.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  SITE, LICENCES, licenceBlock, readSelection, writeData, GENERATED_AT, hasBannedDash,
} from './lib/corpus.mjs';
import { toHiragana } from '../js/vendor/wanakana.js';

const TOOL = 'tools/build-sets.mjs';
/**
 * The `version` every set carries, a YYYY-MM-DD date the contract asks to be
 * bumped on any content change. It is this file's own constant rather than the
 * corpus's GENERATED_AT because a set changes when the generator changes, not
 * only when the corpus does: adding the yoon rows moved no corpus file.
 */
const VERSION = '2026-09-07';
const FORMAT = 'neo-quiz-set/1';
const INDEX_FORMAT = 'neo-quiz-set-index/1';
const VOWELS = ['a', 'i', 'u', 'e', 'o'];

/** Everything this run could not derive, printed at the end and never hidden. */
const skipped = [];
function skip(setId, what) { skipped.push(`${setId}: ${what}`); }

function readData(rel) {
  const abs = path.join(SITE, 'data', rel);
  if (!fs.existsSync(abs)) { process.stderr.write(`missing ${abs}\n`); process.exit(1); }
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

/** { en, es } from a corpus value that may be a string, an object or absent. */
function bilingual(v) {
  if (typeof v === 'string') return { en: v, es: null };
  if (!v || typeof v !== 'object') return null;
  const en = typeof v.en === 'string' ? v.en : null;
  const es = typeof v.es === 'string' ? v.es : null;
  return en === null && es === null ? null : { en, es };
}

// ---------------------------------------------------------------- kana helpers

/** The small kana that join the beat before them. U+30A1.. and U+3041.. */
const SMALL = new Set([...'ァィゥェォャュョヮ', ...'ぁぃぅぇぉゃゅょゎ']);
const SMALL_VOWEL = {
  'ァ': 'a', 'ィ': 'i', 'ゥ': 'u', 'ェ': 'e', 'ォ': 'o', 'ャ': 'ya', 'ュ': 'yu', 'ョ': 'yo',
  'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o', 'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo',
};

/**
 * One kana is one beat; a small kana joins the beat before it. ッ, ー and ン
 * are beats of their own, which is the point of the game.
 */
export function moraSplit(kana) {
  const out = [];
  for (const ch of kana) {
    if (SMALL.has(ch) && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/** glyph -> romaji, from a kana table's gojuon rows, dakuten rows and yoon. */
function romajiMap(table) {
  const map = new Map();
  for (const row of Object.values(table.rows)) for (const k of row) map.set(k.glyph, k.romaji);
  for (const row of Object.values(table.dakuten)) for (const k of row) map.set(k.glyph, k.romaji);
  for (const k of table.yoon || []) if (k.romaji) map.set(k.glyph, k.romaji);
  return map;
}

/**
 * ASCII transliteration used for ids only. Not Hepburn (a long vowel is the
 * vowel doubled, not a macron) and never shown to a learner. Frozen: changing
 * its output changes every loanword item id, see the header.
 */
export function idRomaji(kana, map) {
  let out = '';
  let geminate = false;
  const morae = moraSplit(kana);
  for (const mora of morae) {
    let r;
    if (mora === 'ー') {
      const last = out.match(/[aeiou]$/);
      r = last ? last[0] : '';
    } else if (mora === 'ッ' || mora === 'っ') {
      geminate = true;
      continue;
    } else if (map.has(mora)) {
      r = map.get(mora);
    } else if (mora.length === 2 && map.has(mora[0]) && SMALL_VOWEL[mora[1]]) {
      // An extended digraph the table lists with romaji null: the base's
      // consonant plus the small kana's vowel. ファ -> fa, ティ -> ti, ウィ -> wi.
      const base = map.get(mora[0]);
      const stem = base === 'u' ? 'w' : base === 'i' ? 'y' : base.replace(/[aeiou]$/, '');
      r = stem + SMALL_VOWEL[mora[1]];
    } else {
      throw new Error(`cannot transliterate ${mora} in ${kana}`);
    }
    if (geminate && r) { out += r[0]; geminate = false; }
    out += r;
  }
  return out.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** A long vowel in macron style, the one spelling the contract allows. */
const MACRON = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

/**
 * The onset a digraph's base contributes: the base's reading without its
 * vowel. ウ is the one bare vowel the contract reads as an onset, in the u row
 * it opens (ウィ ウェ ウォ are wi, we, wo). Any other bare vowel base gives
 * nothing, and a digraph the tables cannot read that way is left out rather
 * than guessed at: that is why イェ is in no row.
 */
export function digraphOnset(baseRomaji) {
  const stem = baseRomaji.replace(/[aiueo]$/, '');
  if (stem) return stem;
  return baseRomaji === 'u' ? 'w' : null;
}

/** ファ from フ and ァ: the base's onset plus the small kana's vowel. */
export function digraphSound(baseRomaji, small) {
  const vowel = SMALL_VOWEL[small];
  const onset = digraphOnset(baseRomaji);
  return vowel && onset ? onset + vowel : null;
}

/** One mora read through the tables: a listed kana, or a derived digraph. */
function readMora(mora, map, kana) {
  if (map.has(mora)) return map.get(mora);
  const chars = [...mora];
  if (chars.length === 2 && map.has(chars[0])) {
    const sound = digraphSound(map.get(chars[0]), chars[1]);
    if (sound) return sound;
  }
  throw new Error(`the kana tables cannot read ${mora} in ${kana}`);
}

/**
 * Hepburn in macron style, derived from the kana through the tables: ー
 * lengthens the vowel before it (ā ī ū ē ō, never oo or ou), ッ doubles the
 * consonant after it (ch is written tch, as Hepburn does), ン is n and n'
 * before a vowel or y. This is the fallback for a beats item whose corpus
 * record carries no romaji line; the corpus's own line always wins. A kana
 * the tables cannot read throws, which fails the build by contract, because a
 * romaji the learner is shown after the answer may not be a guess.
 */
export function hepburn(kana, map) {
  let out = '';
  let geminate = false;
  let afterN = false;
  for (const mora of moraSplit(kana)) {
    if (mora === 'ー') {
      const last = out.slice(-1);
      if (!MACRON[last]) throw new Error(`nothing to lengthen before the bar in ${kana}`);
      out = out.slice(0, -1) + MACRON[last];
      afterN = false;
      continue;
    }
    if (mora === 'ッ' || mora === 'っ') { geminate = true; continue; }
    let r = readMora(mora, map, kana);
    if (afterN && /^[aiueoy]/.test(r)) out += "'";
    if (geminate) { r = r.startsWith('ch') ? `t${r}` : r[0] + r; geminate = false; }
    out += r;
    afterN = r === 'n';
  }
  if (geminate) throw new Error(`${kana} ends on a small tsu with no consonant to double`);
  return out;
}

// ---------------------------------------------------------------- beats

function beatsSet(spec) {
  const seed = readData(spec.from);
  const rulesDoc = spec.rules ? readData(spec.rules) : null;
  const rules = new Map((rulesDoc?.rules || []).map((r) => [r.id, r]));
  const kata = romajiMap(readData('kana/katakana.json'));
  const items = [];
  const seen = new Set();
  let fromWord = 0;
  let fromRule = 0;

  // The teacher panel is adding explain lines to rules.json and to seed words,
  // and rule pointers to seed words. Read whatever is there. The pointer: a
  // singular `rule` wins, then the first of the word's `rules`, then the
  // verified table's `en_source`, then nothing. The explain line: the word's
  // own wins, because it says why THIS word has these beats; then its rule's
  // line, which is about the rule; then null, never a line of our own.
  const pointer = (entry) => {
    if (typeof entry.rule === 'string' && entry.rule) return entry.rule;
    if (Array.isArray(entry.rules) && entry.rules.length) return entry.rules[0];
    if (typeof entry.en_source === 'string' && entry.en_source) return entry.en_source;
    return null;
  };
  const explainFor = (entry, ruleId) => {
    const own = bilingual(entry.explain);
    if (own) { fromWord += 1; return own; }
    const r = ruleId && rules.get(ruleId);
    const line = r ? bilingual(r.explain) : null;
    if (line) fromRule += 1;
    return line;
  };

  // The contract: the corpus's own line when it has one, else the kana read
  // through the tables, macron style either way, never null. The derived line
  // is checked against every corpus line we do have, so the fallback is not a
  // path nobody has ever run.
  let derived = 0;
  let agreed = 0;
  const disagree = [];
  const romajiFor = (kana, corpus) => {
    if (!corpus) { derived += 1; return hepburn(kana, kata); }
    let ours = null;
    try { ours = hepburn(kana, kata); } catch (e) { ours = `unreadable: ${e.message}`; }
    if (ours === corpus) agreed += 1;
    else disagree.push(`${kana} corpus ${corpus}, tables ${ours}`);
    return corpus;
  };

  const push = (entry, corpusRomaji, source) => {
    const kana = entry.katakana;
    const word = entry.en;
    if (!word) return skip(spec.id, `${kana}: the corpus gives no English word to show under it (${source})`);
    const romaji = romajiFor(kana, corpusRomaji);
    const split = Array.isArray(entry.split) ? entry.split : moraSplit(kana);
    if (split.join('') !== kana) return skip(spec.id, `${kana}: split does not rejoin to the kana`);
    if (split.length > 9) return skip(spec.id, `${kana} (${word}) has ${split.length} beats and the game's options stop at 9`);
    const id = `lw-${idRomaji(kana, kata)}`;
    if (seen.has(id)) return skip(spec.id, `${kana}: id ${id} collides with an earlier word`);
    seen.add(id);
    const rule = pointer(entry);
    const explain = explainFor(entry, rule);
    items.push({ id, word, kana, romaji, beats: split.length, split, rule, explain });
    return undefined;
  };

  for (const entry of seed.entries) push(entry, entry.romaji, 'entries');

  // The strings the report verified after its table. One that has an English
  // word carries its own romaji, rules and explain line (the teacher panel
  // fills the four together); one with only en_source is the older shape, and
  // then the rule row's example is the sourced romaji. No English word, no item.
  if (spec.include_verified) {
    const noWord = [];
    for (const v of seed.verified?.entries || []) {
      if (!v.en) { noWord.push(v.katakana); continue; }
      let romaji = typeof v.romaji === 'string' && v.romaji ? v.romaji : null;
      if (!romaji && v.en_source) {
        const ex = rules.get(v.en_source)?.examples?.find((e) => Array.isArray(e.katakana) && e.katakana.includes(v.katakana));
        romaji = ex?.romaji || null;
      }
      push(v, romaji, `verified, rule ${pointer(v) || 'none'}`);
    }
    if (noWord.length) skip(spec.id, `${noWord.length} verified strings with no English word in the corpus (${noWord.join(' ')})`);
  }

  const edrdg = LICENCES.edrdg;
  let attribution = edrdg.acknowledgement;
  const extra = {
    note: 'Derived from data/loanwords/seed.json, which the corpus treats as JMdict-derived, so the set inherits EDRDG share-alike terms and the per-screen acknowledgement. The beat split is mechanical from the katakana. rule is the corpus pointer; explain is the word\'s own line from seed.json when it has one, else that rule\'s line from rules.json; null means the corpus has neither yet.',
  };
  if (fromRule && rulesDoc?._licence?.acknowledgement) {
    // A rule-level explain line is rules.json prose, which carries its own
    // credit. A word-level line lives in seed.json and is covered by its block.
    attribution = `${attribution} ${rulesDoc._licence.acknowledgement}`;
    extra.also = rulesDoc._licence.acknowledgement;
  }
  return {
    lang: 'ja',
    licence: { spdx: edrdg.spdx, screen: 'required', attribution, source: edrdg.url },
    _licence: licenceBlock('edrdg', TOOL, extra),
    items,
    summary: `${items.length} words: ${fromWord} explained by the word's own line, ${fromRule} by the rule's, ${items.length - fromWord - fromRule} with none`
      + `; romaji ${items.length - derived} from the corpus (the tables re-read ${agreed} of them the same way), ${derived} read off the kana`,
    notes: disagree.length
      ? [`${disagree.length} corpus romaji lines the kana tables read differently (the corpus line ships): ${disagree.join('; ')}`]
      : [],
  };
}

// ---------------------------------------------------------------- kana (sound and pairs)

/**
 * The records a kana set is built from, in the order a chart reads: the gojuon
 * rows, the dakuten rows, the yoon rows, then the extended digraphs (katakana
 * only). Each record carries the row and the column the feedback strip is
 * built from, and no two records share a sound: the engine cannot ask "which
 * kana makes ji" when two do.
 *
 * A yoon row is labelled by its onset, which is its reading without the vowel
 * (kya -> ky, sha -> sh, ja -> j), and its columns are ya, yu, yo.
 *
 * An extended digraph is read as its base's onset plus the small kana's vowel
 * (ファ -> fa), the corpus carrying romaji null for all of them. It joins its
 * base's row where the chart has a hole in that column (ヴァ ヴィ ヴェ ヴォ
 * beside ヴ in v) and otherwise opens a row named by the base's reading (fu,
 * te, to, de, do, u, shi, chi, ji, tsu); one with a small ャュョ goes to the
 * yoon row of its onset (デュ in dy). The hole is judged against the chart,
 * not against this set, so ディ opens the de row rather than filling the d
 * row's i cell, which is ヂ's.
 *
 * Four kinds of record are left out and every one of them is reported: a kana
 * the corpus flags rare (ぢ, づ, which sound like the z row), a digraph whose
 * sound a plain kana already owns (ウォ is ヲ's wo once オ has taken o, and
 * クァ クィ クェ クォ グァ are the k and g rows'), a digraph whose base is a
 * bare vowel and gives no onset (イェ), and the single ヴ the extended table
 * lists, which is already the v row's kana.
 */
function kanaRecords(table, setId) {
  const out = [];
  const map = romajiMap(table);
  const sounds = new Map();
  const cells = new Set();
  const rowOfGlyph = new Map();
  const take = (glyph, sound, row, column) => {
    out.push({ glyph, sound, row, column });
    sounds.set(sound, glyph);
    cells.add(`${row}/${column}`);
  };

  const rows = [
    ...table.row_order.map((r) => table.rows[r]),
    ...table.dakuten_order.map((r) => table.dakuten[r]),
  ];
  for (const row of rows) {
    for (const k of row) {
      const column = VOWELS.includes(k.romaji.slice(-1)) ? k.romaji.slice(-1) : null;
      // The chart's cell is filled whether or not this set can ask about it,
      // which is what an extended digraph looks for before joining a row.
      cells.add(`${k.row}/${column}`);
      rowOfGlyph.set(k.glyph, k.row);
      if (k.rare) { skip(setId, `${k.glyph} (${k.romaji}) is flagged rare and sounds like a z-row kana; excluded`); continue; }
      // を is written o in Hepburn and the corpus accepts wo too; a sound that
      // is already taken falls back to the next accepted reading.
      let sound = k.romaji;
      if (sounds.has(sound)) sound = (k.accept || []).find((a) => !sounds.has(a)) || null;
      if (!sound) { skip(setId, `${k.glyph}: every reading (${(k.accept || [k.romaji]).join(', ')}) is taken by another kana`); continue; }
      take(k.glyph, sound, k.row, column);
    }
  }

  for (const y of table.yoon || []) {
    const column = SMALL_VOWEL[y.small];
    const row = y.romaji.replace(/[aiueo]$/, '');
    if (!column || !row) { skip(setId, `${y.glyph} (${y.romaji}): no yoon row and column read off it`); continue; }
    if (sounds.has(y.romaji)) { skip(setId, `${y.glyph} (${y.romaji}) is the sound of ${sounds.get(y.romaji)} already; excluded`); continue; }
    take(y.glyph, y.romaji, row, column);
  }

  for (const e of table.extended?.entries || []) {
    const chars = [...e.glyph];
    if (chars.length !== 2) {
      skip(setId, `${e.glyph} is one character and the ${rowOfGlyph.get(e.glyph) || 'chart'} row already carries it; the extended table lists it as a spelling, not a new sound`);
      continue;
    }
    const [baseGlyph, small] = chars;
    const base = map.get(baseGlyph);
    const baseRow = rowOfGlyph.get(baseGlyph);
    if (!base || !baseRow) { skip(setId, `${e.glyph}: the tables do not read its base ${baseGlyph}`); continue; }
    const sound = digraphSound(base, small);
    if (!sound) { skip(setId, `${e.glyph}: ${baseGlyph} is a bare vowel and gives no onset, so the tables read no sound for it`); continue; }
    if (sounds.has(sound)) { skip(setId, `${e.glyph} (${sound}) is the sound of ${sounds.get(sound)} already; a digraph a plain kana owns is left out`); continue; }
    const column = SMALL_VOWEL[small];
    const row = ['ya', 'yu', 'yo'].includes(column)
      ? sound.replace(/[aiueo]$/, '')
      : (cells.has(`${baseRow}/${column}`) ? base : baseRow);
    take(e.glyph, sound, row, column);
  }
  return out;
}

function soundSet(spec) {
  const table = readData(spec.from);
  const records = kanaRecords(table, spec.id);
  const bySound = new Map(records.map((r) => [r.sound, r]));
  const byGlyph = new Map(records.map((r) => [r.glyph, r]));
  const items = records.map(({ glyph, sound, row, column }) => {
    const item = { id: `${spec.prefix}-${sound}`, kana: glyph, sound, row, column };
    // The corpus lists the glyphs learners mix up. Lead the distractors with
    // those, then fill from the same row, so the wrong options are the ones a
    // person would actually pick.
    const group = (table.confusables || []).find((c) => c.glyphs.includes(glyph));
    if (group) {
      const d = group.glyphs.filter((g) => g !== glyph && byGlyph.has(g)).map((g) => byGlyph.get(g).sound);
      for (const r of records) {
        if (d.length >= 3) break;
        if (r.row === row && r.sound !== sound && !d.includes(r.sound)) d.push(r.sound);
      }
      for (const r of records) {
        if (d.length >= 3) break;
        if (r.column === column && r.sound !== sound && !d.includes(r.sound)) d.push(r.sound);
      }
      if (d.length >= 3 && d.every((s) => bySound.has(s))) item.distractors = d;
    }
    return item;
  });
  return {
    lang: 'ja',
    licence: { spdx: 'public-domain', screen: 'none' },
    _licence: {
      ...table._licence,
      generated_by: TOOL,
      generated_at: GENERATED_AT,
      note: `Derived from data/${spec.from}: the gojuon rows, the dakuten rows, the yoon rows and the extended digraphs, one item per kana, row and column carried. A digraph's sound is read off its base and its small kana; the character inventory is a fact and carries no licence.`,
    },
    items,
    summary: `${items.length} kana in ${new Set(items.map((i) => i.row)).size} rows, ${items.filter((i) => i.distractors).length} with confusable-led distractors`,
  };
}

function kanaPairsSet(spec) {
  const table = readData(spec.from);
  const records = kanaRecords(table, spec.id);
  // A kana pairs item carries row and column as its sound sibling does, so a
  // chapter can filter one row of the board the way it filters one row of the
  // sound game.
  const items = records.map(({ glyph, sound, row, column }) => ({
    id: `${spec.prefix}-${sound}`, left: glyph, right: sound, row, column,
  }));
  return {
    lang: 'ja',
    licence: { spdx: 'public-domain', screen: 'none' },
    _licence: {
      ...table._licence,
      generated_by: TOOL,
      generated_at: GENERATED_AT,
      note: `Derived from data/${spec.from}: kana on the left, its Hepburn romaji on the right, row and column carried for the filter. Nothing else is on the board.`,
    },
    items,
    summary: `${items.length} pairs in ${new Set(items.map((i) => i.row)).size} rows`,
  };
}

// ---------------------------------------------------------------- vocab pairs

/** trim, casefold, strip accents: the contract's folding for a pairs board. */
export function fold(s) {
  return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/** Drop every (...) group, nested ones included, and tidy the spaces. */
function stripParens(s) {
  let out = s;
  let prev;
  do { prev = out; out = out.replace(/\([^()]*\)/g, ''); } while (out !== prev);
  return out.replace(/\s+/g, ' ').replace(/\s+([,;.])/g, '$1').trim();
}

/**
 * Cut a JMdict sense on its ";" separators, but never on one inside brackets.
 * A plain split() on ";" cuts "please (give me; do for me)" into "please (give
 * me" and "do for me)", and the first of those is what the board would print:
 * a meaning with an unclosed bracket, which stripParens cannot repair because
 * there is nothing left to match. Two entries in the corpus hit it today,
 * JMdict 1430230 and 1550770, and neither is in a shipped set before this
 * change, so no existing item id or meaning moves.
 */
function splitSense(sense) {
  const out = [];
  let depth = 0;
  let buf = '';
  for (const ch of sense) {
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf);
  return out;
}

/**
 * The meanings a JMdict entry offers, shortest first: each sense split on
 * ";", the parenthetical stripped, then the same segment with it kept. The
 * first one that is unique on the board and does not contain the word wins.
 */
function meaningCandidates(gloss) {
  const out = [];
  for (const sense of gloss) {
    for (const seg of splitSense(sense)) {
      const full = seg.trim();
      const bare = stripParens(full);
      if (bare && !out.includes(bare)) out.push(bare);
      if (full && full !== bare && !out.includes(full)) out.push(full);
    }
  }
  return out;
}

/**
 * The groups of a vocab slice this set is built from.
 *
 * `groups` on a selection row is an allow list, and its default is every group
 * the slice declares. It exists because a pairs board is a set of words that
 * each own a distinct meaning, and one group in this corpus is by design the
 * opposite: `register` in data/vocab/ch11.json is six acts said three ways, so
 * the eighteen words offer six meanings between them. Built whole, that slice
 * loses two words outright and prints "to drink" beside the honorific for eat.
 * The chapter never asks for a register pairs round, so the row names the one
 * group it does ask for and the rest of the slice stays out of the set.
 */
function pairGroups(spec, src) {
  if (!Array.isArray(spec.groups)) return src.order;
  for (const g of spec.groups) {
    if (!src.groups[g]) throw new Error(`${spec.id}: groups names ${g}, which data/${spec.from} does not carry`);
  }
  return src.order.filter((g) => spec.groups.includes(g));
}

function vocabPairsSet(spec) {
  const src = readData(spec.from);
  const meanings = spec.meanings_es || {};
  const pins = spec.meanings_en || {};
  const items = [];
  const rights = new Set();
  const missing = [];
  const used = new Set();
  const pinsLeft = new Set(Object.keys(pins));
  for (const groupId of pairGroups(spec, src)) {
    for (const w of src.groups[groupId]) {
      const left = w.word;
      const fl = fold(left);
      const offered = meaningCandidates(w.gloss);
      // A pin picks which of the entry's OWN meanings this pair shows, and the
      // assertion is what keeps it a choice rather than an authored gloss: a
      // string the entry does not offer stops the run. It is here because the
      // automatic pick is "shortest first", and the shortest is sometimes the
      // one another word needs more: two expressions in ch14 both reduce to
      // "thank you", and whichever is reached first takes it and drops the
      // other off the board entirely.
      if (pins[w.id] !== undefined) {
        if (!offered.includes(pins[w.id])) {
          throw new Error(`${spec.id}: meanings_en pins "${pins[w.id]}" on ${w.id} ${left}, which is not one of the meanings data/${spec.from} carries for it (${offered.join(' | ')})`);
        }
        pinsLeft.delete(w.id);
      }
      const right = pins[w.id] !== undefined ? pins[w.id] : offered.find((m) => {
        const fr = fold(m);
        return fr && !rights.has(fr) && fr !== fl && !fr.includes(fl) && !fl.includes(fr) && !hasBannedDash(m);
      });
      if (!right) { skip(spec.id, `${w.id} ${left}: every meaning the corpus gives is already on another pair (${w.gloss[0]})`); continue; }
      if (rights.has(fold(right))) {
        throw new Error(`${spec.id}: meanings_en pins "${right}" on ${w.id} ${left}, and another pair already prints it`);
      }
      rights.add(fold(right));
      // The corpus is a JMdict slice and carries English only. The Spanish is
      // the selection file's, written against the meaning this pair actually
      // shows, and a word it does not name ships with es null: the board then
      // prints the English and the honesty line says so.
      const es = typeof meanings[w.id] === 'string' && meanings[w.id].trim() ? meanings[w.id].trim() : null;
      if (!es) missing.push(`${w.id} ${left} (${right})`);
      const item = { id: w.id, left, right: { en: right, es }, group: groupId };
      used.add(groupId);
      // The reading is never on the board (it would give the word away for a
      // kana-only entry and is what a kanji entry is testing). It surfaces in
      // the feedback after a miss, which is what note is for.
      if (w.has_kanji && w.kana && w.kana !== left) item.note = w.kana;
      items.push(item);
    }
  }
  if (missing.length) skip(spec.id, `${missing.length} pairs with no Spanish meaning in tools/selection/sets.json (${missing.join('; ')})`);
  if (pinsLeft.size) {
    throw new Error(`${spec.id}: meanings_en names ${[...pinsLeft].join(', ')}, which data/${spec.from} does not carry in the groups this set builds`);
  }

  // The Spanish board prints es, or the English when es is null, and two pairs
  // that print the same word are one pair the learner cannot answer. A clash
  // drops the Spanish rather than the pair: the English board is unaffected.
  const seen = new Map();
  for (const it of items) {
    const shown = it.right.es || it.right.en;
    const key = fold(shown);
    if (seen.has(key)) {
      skip(spec.id, `${it.id} ${it.left}: the Spanish "${shown}" is already ${seen.get(key)}'s on a Spanish board; dropped to null`);
      it.right.es = null;
    } else seen.set(key, it.id);
    const fl = fold(it.left);
    const fe = it.right.es ? fold(it.right.es) : '';
    if (fe && (fe === fl || fe.includes(fl) || fl.includes(fe))) {
      skip(spec.id, `${it.id} ${it.left}: the Spanish "${it.right.es}" puts the left side on the board; dropped to null`);
      it.right.es = null;
    }
  }

  // The rungs of the chapter are the groups a filtered round names, so the set
  // declares the ones it used and no more, in the corpus's own words.
  const groups = {};
  for (const g of pairGroups(spec, src)) {
    if (!used.has(g)) continue;
    const label = src.labels?.[g];
    if (label) groups[g] = label;
    else skip(spec.id, `group ${g}: data/${spec.from} gives it no label, so a filtered round has no words for its header`);
  }

  const edrdg = LICENCES.edrdg;
  return {
    lang: 'ja',
    licence: { spdx: edrdg.spdx, screen: 'required', attribution: edrdg.acknowledgement, source: edrdg.url },
    _licence: licenceBlock('edrdg', TOOL, {
      chapter: src.chapter,
      note: `Derived from data/${spec.from}, a JMdict slice. left is the headword, right the first JMdict meaning that is unique on the board with the Spanish from tools/selection/sets.json beside it, note the kana reading for a kanji headword, group the rung the word sits in.`,
    }),
    groups,
    items,
    summary: `${items.length} pairs from ${pairGroups(spec, src).reduce((a, g) => a + src.groups[g].length, 0)} words, ${items.filter((i) => i.right.es).length} with Spanish, in ${Object.keys(groups).length} groups`,
  };
}

// ---------------------------------------------------------------- order (one set per song)

/**
 * The pieces of a song line, cut on the word boundaries the corpus records.
 *
 * The kana line carries a space at the phrase break only ("ここはどこの
 * ほそみちじゃ"), so cutting there gives two pieces and a two-piece order is a
 * coin flip (design review, 2026-09-05). The same verse carries a romaji line
 * with every word apart ("koko wa doko no hosomichi ja"), so each romaji word
 * is converted to hiragana and matched in turn against the kana with the
 * spaces removed; when every word lands and nothing is left over, those are
 * the pieces. Three joins follow, none of them a judgment about Japanese:
 * a one-kana piece joins the piece before it (は, の, を: a particle chip
 * carries no melody; the first piece joins the one after it instead), a
 * piece repeated straight after itself is one piece ("よい よい", a refrain),
 * and a piece that still reads the same as another joins the piece before it,
 * so two chips never read the same and there is exactly one right order.
 *
 * A line whose romaji does not align (a small ぁ the romaji writes plain, a
 * word the researcher spelt another way) falls back to the corpus's spaces and
 * says so; a line that still has fewer than three pieces is skipped and
 * reported, never padded. Every piece is a substring of the corpus line.
 */
const PARTICLE_ROMAJI = { wa: 'は', o: 'を', e: 'へ' };

function kanaCandidates(word) {
  const out = new Set([toHiragana(word)]);
  if (PARTICLE_ROMAJI[word]) out.add(PARTICLE_ROMAJI[word]);
  if (word.endsWith('wa')) out.add(toHiragana(word.slice(0, -2)) + 'は');
  // The researcher writes Hepburn zu and ji; the kana may be づ or ぢ.
  for (const [from, to] of [['zu', 'du'], ['ji', 'di']]) {
    if (word.includes(from)) out.add(toHiragana(word.split(from).join(to)));
  }
  return [...out].filter(Boolean);
}

/** The romaji words matched onto the kana, or null when they do not fit. */
export function alignRomaji(kanaLine, romajiLine) {
  const flat = kanaLine.replace(/\s+/g, '');
  const words = String(romajiLine || '').toLowerCase().replace(/[,.;:!?"]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const pieces = [];
  let pos = 0;
  for (const word of words) {
    const hit = kanaCandidates(word).find((c) => c && flat.startsWith(c, pos));
    if (!hit) return null;
    pieces.push(hit);
    pos += hit.length;
  }
  return pos === flat.length ? pieces : null;
}

/** One code point: a lone kana, not a digraph like じゃ. */
const isOneKana = (piece) => [...piece].length === 1;

/** The three joins. Pure; exported for the check in tools/. */
export function joinPieces(pieces) {
  let out = [];
  for (const piece of pieces) {
    if (isOneKana(piece) && out.length) out[out.length - 1] += piece;
    else out.push(piece);
  }
  if (out.length > 1 && isOneKana(out[0])) out.splice(0, 2, out[0] + out[1]);
  // A refrain: a run of pieces repeated straight after itself, at any period.
  let merged = true;
  while (merged) {
    merged = false;
    for (let period = 1; period <= out.length / 2 && !merged; period += 1) {
      for (let i = 0; i + 2 * period <= out.length; i += 1) {
        const a = out.slice(i, i + period);
        const b = out.slice(i + period, i + 2 * period);
        if (a.every((x, k) => x === b[k])) {
          out.splice(i, 2 * period, [...a, ...b].join(' '));
          merged = true;
          break;
        }
      }
    }
  }
  // Two pieces that still read the same: the first joins the piece before it.
  for (let guard = 0; guard < 9; guard += 1) {
    const seen = new Map();
    const dup = out.findIndex((p, i) => (seen.has(p) ? true : (seen.set(p, i), false)));
    if (dup === -1) break;
    const first = out.indexOf(out[dup]);
    const at = first > 0 ? first : dup;
    out.splice(at - 1, 2, `${out[at - 1]} ${out[at]}`);
  }
  return out;
}

/** The pieces for one line: aligned romaji when it fits, else the corpus spaces. */
export function songPieces(kanaLine, romajiLine) {
  const aligned = alignRomaji(kanaLine, romajiLine);
  const raw = aligned || kanaLine.trim().split(/\s+/).filter(Boolean);
  return { tokens: joinPieces(raw), aligned: !!aligned };
}

function songSets(spec) {
  const index = readData(spec.from);
  const out = [];
  for (const row of index.songs) {
    const song = readData(row.src.replace(/^data\//, ''));
    const setId = spec.id.replace('{song}', song.id);
    const items = [];
    let aligned = 0;
    let spanish = 0;
    for (const verse of song.verses) {
      // The gloss is the researcher's English, one per verse, and every line of
      // the verse shows it. The Spanish is the selection file's, keyed by song
      // and verse; a verse it does not name ships with es null.
      const verseEs = spec.glosses_es?.[song.id]?.[String(verse.n)];
      if (typeof verseEs !== 'string' || !verseEs.trim()) {
        skip(setId, `${song.id} verse ${verse.n}: tools/selection/sets.json carries no Spanish gloss, so every line of it falls back to English`);
      } else spanish += 1;
      verse.lines.forEach((line, i) => {
        const id = `${song.id}-v${verse.n}-l${i + 1}`;
        const romaji = Array.isArray(verse.romaji_lines) ? verse.romaji_lines[i] : null;
        const cut = songPieces(line, romaji);
        if (!cut.aligned) skip(setId, `${id} "${line}": the romaji "${romaji}" does not align with the kana, so the pieces are the corpus's spaces`);
        const { tokens } = cut;
        if (tokens.length < 3) return skip(setId, `${id} "${line}" has ${tokens.length} piece${tokens.length === 1 ? '' : 's'} once repeats are joined; fewer than three is no puzzle`);
        if (tokens.length > 9) return skip(setId, `${id} "${line}" has ${tokens.length} pieces and the bank stops at 9`);
        if (cut.aligned) aligned += 1;
        items.push({
          id,
          tokens,
          line: tokens.join(' '),
          gloss: { en: verse.gloss, es: typeof verseEs === 'string' && verseEs.trim() ? verseEs.trim() : null },
        });
        return undefined;
      });
    }
    if (!items.length) { skip(setId, 'no line with three or more pieces; set not written'); continue; }
    const t = song.title;
    const c = song.credits;
    const title = `${t.ja} (${t.romaji})`;
    const lic = song._licence;
    const attribution = `${title}. Words: ${c.lyricist}. Music: ${c.composer}. First published ${c.first_published}. Public domain in Japan and the United States.`;
    out.push({
      id: setId,
      name: { en: title, es: null },
      skill: spec.skill,
      budget_kb: spec.budget_kb,
      built: {
        lang: 'ja',
        licence: { spdx: 'public-domain', screen: 'none', attribution, source: lic.url },
        _licence: {
          ...lic,
          generated_by: TOOL,
          generated_at: GENERATED_AT,
          note: `Derived from ${row.src}: one item per line, the pieces cut on the word boundaries of the corpus's romaji line aligned onto the kana (a one-kana piece joins the piece before it, a repeated piece is one piece), the verse gloss shown after a miss. Verdicts, credits and the authors' death years are copied from that file.${t.qualifier ? ` Qualifier: ${t.qualifier}.` : ''}`,
        },
        items,
        summary: `${items.length} lines, ${aligned} cut on the romaji's words, ${spanish} of ${song.verses.length} verse glosses in Spanish`,
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------- main

const BUILDERS = { beats: beatsSet, sound: soundSet, 'kana-pairs': kanaPairsSet, 'vocab-pairs': vocabPairsSet };
const GAME = { beats: 'beats', sound: 'sound', 'kana-pairs': 'pairs', 'vocab-pairs': 'pairs', order: 'order' };

function main() {
  const sel = readSelection('sets.json');
  const QUIZ = path.resolve(SITE, sel.targets.quiz_site);
  const bookDir = path.join(SITE, 'books', sel.targets.runcible_book, 'sets');
  const quizDir = path.join(QUIZ, 'data', 'sets');
  const catalog = [];
  const jobs = [];

  for (const spec of sel.sets) {
    if (spec.kind === 'order') { jobs.push(...songSets(spec)); continue; }
    const build = BUILDERS[spec.kind];
    if (!build) throw new Error(`unknown set kind: ${spec.kind}`);
    jobs.push({
      id: spec.id, name: spec.name, skill: spec.skill, budget_kb: spec.budget_kb,
      built: build(spec), kind: spec.kind, escape: spec.escape || [],
    });
  }

  for (const job of jobs) {
    const { built } = job;
    const game = GAME[job.kind || 'order'];
    const set = {
      format: FORMAT,
      id: job.id,
      version: VERSION,
      game,
      name: job.name,
      lang: built.lang,
      skill: job.skill,
      licence: built.licence,
      _licence: built._licence,
      ...(built.groups && Object.keys(built.groups).length ? { groups: built.groups } : {}),
      items: built.items,
    };
    const quizPath = path.join(quizDir, `${job.id}.json`);
    const bookPath = path.join(bookDir, `${job.id}.json`);
    // `escape` is the selection row's, and it is empty on every set but the
    // grade 2 kanji one. See writeData in lib/corpus.mjs: one character of
    // KANJIDIC's own grade 2 list is also the whole title of a banned song, so
    // a slice that carries it is emitted with that character escaped. The
    // parsed value is identical and both copies get the same bytes, so the cmp
    // below still holds.
    writeData(quizPath, set, job.budget_kb, job.escape);
    writeData(bookPath, set, job.budget_kb, job.escape);
    if (!fs.readFileSync(quizPath).equals(fs.readFileSync(bookPath))) {
      throw new Error(`${job.id}: the two copies differ, which the writer makes impossible`);
    }
    catalog.push({
      id: job.id,
      // `file` is relative to the Quiz site root, the way Rappel's index names decks.
      file: `data/sets/${job.id}.json`,
      game,
      name: job.name,
      items: built.items.length,
      licence: built.licence.spdx,
      screen: built.licence.screen,
    });
    process.stdout.write(`  ${job.id}: ${built.summary}\n`);
    for (const note of built.notes || []) process.stdout.write(`    note: ${note}\n`);
  }

  // A static site cannot list a directory, so the library reads one file.
  const index = {
    _note: `Generated by runcible-site/${TOOL}. Each set it names carries its own licence block; this index carries none of its own.`,
    format: INDEX_FORMAT,
    version: VERSION,
    sets: catalog,
  };
  writeData(path.join(quizDir, 'index.json'), index, 40);

  process.stdout.write(`\n${catalog.length} sets, ${catalog.reduce((a, s) => a + s.items, 0)} items\n`);
  if (skipped.length) {
    process.stdout.write(`\n${skipped.length} could not be derived from the corpus:\n`);
    for (const s of skipped) process.stdout.write(`  ${s}\n`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('build-sets.mjs')) main();
