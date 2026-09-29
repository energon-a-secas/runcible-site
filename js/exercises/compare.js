// ── The compare pipeline ─────────────────────────────────────
// C2.4: "how the produced string is graded. Tokens, pipe separated, applied in
// order: trim, casefold, strip-accents, collapse-space, kana. Default
// trim|casefold."
//
// Every token is a pure string fold with no dictionary and no dependency. The
// last one carries a script name because the frozen contract named it: it folds
// the Katakana Unicode block onto the Hiragana block, which is the same kind of
// operation as strip-accents folding the Latin combining marks. It is not a
// language feature and it does not make the engine topic aware. A romaji reader
// is a different thing entirely and is a Book transform (C2.4), not a token.

/** C2.4's stated default. */
export const DEFAULT_COMPARE = 'trim|casefold';

const HIRAGANA_SMALL_A = 0x3041;
const KATAKANA_SMALL_A = 0x30a1;
const KATAKANA_VU = 0x30f6;
const BLOCK_OFFSET = KATAKANA_SMALL_A - HIRAGANA_SMALL_A;

/**
 * Fold the Katakana block onto the Hiragana block.
 *
 * NFKC first, so halfwidth forms become fullwidth ones before the shift. The
 * prolonged sound mark and the iteration marks sit outside the shifted range
 * and are left where they are, which is correct: they have no hiragana twin.
 */
function foldKatakana(s) {
  let out = '';
  for (const ch of s.normalize('NFKC')) {
    const code = ch.codePointAt(0);
    out += (code >= KATAKANA_SMALL_A && code <= KATAKANA_VU)
      ? String.fromCodePoint(code - BLOCK_OFFSET)
      : ch;
  }
  return out;
}

/** The closed set. An unknown token is a chapter authoring error, not a no-op. */
export const COMPARE_TOKENS = Object.freeze({
  'trim': (s) => s.trim(),
  'casefold': (s) => s.toLowerCase(),
  'strip-accents': (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  'collapse-space': (s) => s.replace(/\s+/g, ' ').trim(),
  'kana': foldKatakana,
});

/**
 * Split and check a compare string.
 * @param {string} [compare] e.g. "trim|kana"
 * @returns {{ tokens: string[], unknown: string[] }}
 */
export function parseCompare(compare) {
  const raw = (compare === undefined || compare === null || compare === '')
    ? DEFAULT_COMPARE : String(compare);
  const tokens = raw.split('|').map((t) => t.trim()).filter(Boolean);
  const unknown = tokens.filter((t) => !(t in COMPARE_TOKENS));
  return { tokens, unknown };
}

/**
 * Apply the tokens in the order written.
 * @param {*} value
 * @param {string[]} tokens
 * @returns {string}
 */
export function normalise(value, tokens) {
  let s = value === null || value === undefined ? '' : String(value);
  for (const t of tokens) {
    const fold = COMPARE_TOKENS[t];
    if (fold) s = fold(s);
  }
  return s;
}

/**
 * Grade a produced string against an expected value.
 *
 * `expected` may be an array, in which case any member matching is correct.
 * That is what lets one item accept two spellings of the same word without a
 * second exercise.
 *
 * @param {string} produced
 * @param {string|string[]} expected
 * @param {string} [compare] the raw compare string from the spec
 * @returns {boolean}
 */
export function isCorrect(produced, expected, compare) {
  const { tokens } = parseCompare(compare);
  const got = normalise(produced, tokens);
  const wanted = Array.isArray(expected) ? expected : [expected];
  return wanted.some((w) => normalise(w, tokens) === got && got !== '');
}

/**
 * Did a heard transcript say the same words as the line it was asked for?
 *
 * For speak, which never grades (C2.1, C2.5): the answer picks which neutral
 * line the learner sees, and never becomes an attempt's `correct`. So it is
 * forgiving where a grader is exact, and only about things a recogniser does
 * on its own: width is folded (NFKC), punctuation and symbols are dropped
 * (a recogniser adds a full stop, or does not), and spaces are ignored. Then
 * the spec's own compare tokens run, so `kana` folds the two syllabaries only
 * when the chapter asked for it, exactly as it would for a typed answer.
 *
 * @param {string} heard the transcript
 * @param {string|string[]} expected the line, or every accepted form of it
 * @param {string} [compare] the raw compare string from the spec
 * @returns {boolean}
 */
export function sameWords(heard, expected, compare) {
  const { tokens } = parseCompare(compare);
  const fold = (v) => normalise(
    String(v === null || v === undefined ? '' : v).normalize('NFKC').replace(/[\p{P}\p{S}]/gu, ' '),
    tokens,
  ).replace(/\s+/g, '');
  const got = fold(heard);
  if (!got) return false;
  const wanted = Array.isArray(expected) ? expected : [expected];
  return wanted.some((w) => fold(w) === got);
}
