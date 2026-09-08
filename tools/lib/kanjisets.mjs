/**
 * Resolving a named kanji set to its list of literals, in one place.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. See tools/lib/sources.mjs.
 *
 * build-kanji.mjs, build-strokes.mjs and build-vocab.mjs all need "which
 * characters are in `grade1`". If each answered that itself, the kanji table,
 * the stroke diagrams and the vocabulary would drift apart the first time a set
 * definition changed, and the symptom would be a chapter whose stroke figure is
 * missing for one character out of eighty.
 */
import { loadZippedJson } from './sources.mjs';
import { readSelection } from './corpus.mjs';

let kanjidicCache = null;

export function kanjidic() {
  if (!kanjidicCache) kanjidicCache = loadZippedJson('kanjidic');
  return kanjidicCache;
}

export function kanjiSelection() {
  return readSelection('kanji.json');
}

/**
 * Every literal of a set before `slice` is applied, in teaching order.
 * A hand-listed set keeps its listed order. A grade-derived set is ordered by
 * KANJIDIC frequency rank, most frequent first, with unranked characters last
 * in dictionary order, because "the first eighty" is only useful if the ones a
 * learner meets first come first.
 */
function wholeSet(set) {
  if (set.literals) return [...set.literals];
  if (set.grade == null) throw new Error(`set ${set.id} has neither literals nor grade`);
  const chars = kanjidic().characters.filter((c) => c.misc.grade === set.grade);
  const rank = (c) => (c.misc.frequency == null ? 9999 : c.misc.frequency);
  chars.sort((a, b) => rank(a) - rank(b));
  return chars.map((c) => c.literal);
}

/**
 * The literals of one set, in teaching order, `slice` applied.
 *
 * `slice` is `[from, to]`, a half-open range over that order, and it exists so
 * that one grade can be taught as two chapters' worth of rungs without a second
 * hand-listed source of truth for which characters those are. Grade 2 is 160
 * characters, which is two passes, not one: `grade2a` is `[0, 80]` and
 * `grade2b` is `[80, 160]`.
 *
 * The bounds are checked here rather than trusted, because a slice that runs
 * past the end of its grade silently emits a short file, and a short file is a
 * chapter with characters missing from the middle of its ladder. Whether two
 * slices of one grade cover it exactly is a question about the whole selection
 * file and is asserted in build-kanji.mjs, which can see every row.
 */
export function resolveSet(set) {
  const all = wholeSet(set);
  if (set.slice === undefined) return all;
  const s = set.slice;
  if (!Array.isArray(s) || s.length !== 2 || !s.every((n) => Number.isInteger(n) && n >= 0)) {
    throw new Error(`set ${set.id}: slice must be [from, to], two non-negative integers`);
  }
  const [from, to] = s;
  if (from >= to) throw new Error(`set ${set.id}: slice [${from}, ${to}] is empty`);
  if (to > all.length) {
    throw new Error(
      `set ${set.id}: slice [${from}, ${to}] runs past the ${all.length} characters this set has`);
  }
  return all.slice(from, to);
}

/** Every literal of a set, ignoring `slice`. The whole a slice is a part of. */
export function unslicedSet(set) {
  return wholeSet(set);
}

export function setById(id) {
  const sel = kanjiSelection();
  const set = sel.sets.find((s) => s.id === id);
  if (!set) throw new Error(`unknown kanji set: ${id}`);
  return set;
}

/** The 176 kana codepoints, from the declared ranges. */
export function kanaLiterals(kanaSet) {
  const out = [];
  for (const [lo, hi] of kanaSet.ranges) {
    for (let c = parseInt(lo, 16); c <= parseInt(hi, 16); c += 1) {
      out.push(String.fromCodePoint(c));
    }
  }
  return out;
}
