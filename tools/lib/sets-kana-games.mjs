/**
 * Quiz sets, the two kana games: sound (which kana makes this sound) and
 * kana-pairs (kana to romaji), both built from one kana table and both
 * carrying the row and the column a chapter filters a round by.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. See tools/build-sets.mjs.
 *
 * One record set feeds both games, which is why kanaRecords is here rather
 * than in either builder: the two boards must agree about which kana the set
 * covers and what each one sounds like, or a chapter that drills a row in one
 * game and tests it in the other is drilling a different row.
 */
import { GENERATED_AT } from './corpus.mjs';
import { TOOL, readData, skip } from './sets-common.mjs';
import { SMALL_VOWEL, VOWELS, digraphSound, romajiMap } from './sets-kana.mjs';

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

export function soundSet(spec) {
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

export function kanaPairsSet(spec) {
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
