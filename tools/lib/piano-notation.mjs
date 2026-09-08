/**
 * Notation: letters, key signatures and which notes print an accidental.
 *
 * Split out of tools/build-piano.mjs, which is the entry point and the only
 * thing that runs. Nothing here reads a file, fetches anything or prints, so
 * every function is a pure table lookup over what the reader already parsed.
 * That is the reason the split falls here: the reader is a state machine over
 * text, and this is arithmetic over letters, and mixing them is what made one
 * file 623 lines.
 */

/** LilyPond's note letters, as a diatonic step within an octave. */
export const LETTERS = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
export const NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
/** The order sharps are written in a key signature; flats are it reversed. */
export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];

export function accidental(alter) {
  if (alter === 0) return '';
  return alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter);
}

/** How many sharps (positive) or flats (negative) the key signature draws. */
export function keySignature(key) {
  if (!key) return { tonic: 'C', mode: 'major', fifths: 0 };
  const major = { c: 0, g: 1, d: 2, a: 3, e: 4, b: 5, f: -1 };
  const minor = { a: 0, e: 1, b: 2, f: -4, c: -3, g: -2, d: -1 };
  const table = key.mode === 'minor' ? minor : major;
  let fifths = table[key.letter];
  if (fifths === undefined) fifths = 0;
  fifths += key.alter * 7;
  return { tonic: NAMES[LETTERS[key.letter]] + accidental(key.alter), mode: key.mode, fifths };
}

/** The alteration the key signature already applies to a letter. */
export function alterInKey(step, fifths) {
  const name = NAMES[step];
  const at = SHARP_ORDER.indexOf(name);
  if (fifths > 0) return at < fifths ? 1 : 0;
  if (fifths < 0) return SHARP_ORDER.length - 1 - at < -fifths ? -1 : 0;
  return 0;
}

/**
 * Which notes print an accidental. Standard practice: one per letter and octave
 * per bar, and a natural where a bar's earlier accidental is cancelled. The
 * generator settles it so that the drawing module never has to.
 */
export function markAccidentals(notes, fifths) {
  const state = new Map();
  return notes.map((n) => {
    const key = `${n.step}:${n.octave}`;
    const standing = state.has(key) ? state.get(key) : alterInKey(n.step, fifths);
    const show = n.alter !== standing;
    if (show) state.set(key, n.alter);
    return { ...n, acc: show ? n.alter : null };
  });
}
