/**
 * Quiz sets: reading kana. Every function here is pure and none of them opens
 * a file, so the split beats, the sound game, the pairs boards and the item
 * ids all read the tables through the same code.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. See tools/build-sets.mjs.
 *
 * THE ONE RULE THAT MATTERS HERE. idRomaji is frozen. An item id is derived
 * from the corpus id of the record it came from, and for a loanword that is
 * this transliteration; quiz:answer carries the id and Runcible stores it as
 * evidence, so an id that moves between runs orphans every attempt a person
 * made on that item and nothing would report it.
 */

/** The five vowels a gojuon column is named by. */
export const VOWELS = ['a', 'i', 'u', 'e', 'o'];

/** The small kana that join the beat before them. U+30A1.. and U+3041.. */
const SMALL = new Set([...'ァィゥェォャュョヮ', ...'ぁぃぅぇぉゃゅょゎ']);
export const SMALL_VOWEL = {
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
export function romajiMap(table) {
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
