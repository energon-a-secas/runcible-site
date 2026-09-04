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
 * The literals of one set, in teaching order.
 * A hand-listed set keeps its listed order. A grade-derived set is ordered by
 * KANJIDIC frequency rank, most frequent first, with unranked characters last
 * in dictionary order, because "the first eighty" is only useful if the ones a
 * learner meets first come first.
 */
export function resolveSet(set) {
  if (set.literals) return [...set.literals];
  if (set.grade == null) throw new Error(`set ${set.id} has neither literals nor grade`);
  const chars = kanjidic().characters.filter((c) => c.misc.grade === set.grade);
  const rank = (c) => (c.misc.frequency == null ? 9999 : c.misc.frequency);
  chars.sort((a, b) => rank(a) - rank(b));
  return chars.map((c) => c.literal);
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
