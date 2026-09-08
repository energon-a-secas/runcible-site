// This Book's own chrome, in { en, es }.
//
// Everything a learner reads that is not content out of a data file: the
// verdict, the Next button, the score line, the two leads, the cue under each
// picture, and the label a screen reader is given for a drawing. It used to be
// English literals sitting in ui.js and staff.js, which meant a Spanish reader
// met a half-translated drill: the chapter around it in Spanish, the drill
// answering "Correct." and offering "Next".
//
// The shape is copied from js/exercises/strings.js on purpose. A Book module
// gets only the frozen api (C2.2), so it cannot import the engine's copy, and
// keeping the same shape means the two cannot drift into two ideas of what a
// chrome string is. Resolving through api.t rather than through a private
// lookup is the point of the shape: the shell's resolver is what records a
// fallback for the honesty line, so a key here that ever lost its Spanish
// would be reported the way untranslated content is, instead of quietly
// rendering in English.
//
// {name} placeholders are filled by say(). A value is inserted as text and is
// never parsed, so a piece title or a learner's own answer cannot become
// markup.

export const STRINGS = Object.freeze({
  // The frame every drill in this Book draws.
  position: { en: '{at} of {total}', es: '{at} de {total}' },
  correct: { en: 'Correct.', es: 'Correcto.' },
  notThatOne: { en: 'Not that one. It is {expected}.', es: 'Esa no. Es {expected}.' },
  next: { en: 'Next', es: 'Siguiente' },
  score: { en: '{right} of {asked} correct.', es: '{right} de {asked} correctas.' },
  continue: { en: 'Continue', es: 'Continuar' },
  couldNotStart: {
    en: 'This drill could not start: {message}',
    es: 'Este ejercicio no pudo empezar: {message}',
  },

  // piano.keys
  keysTitle: { en: 'Name the marked key', es: 'Nombra la tecla marcada' },
  keysLead: {
    en: 'Every key is found from the black key groups, never counted from the end of the keyboard.',
    es: 'Cada tecla se encuentra a partir de los grupos de teclas negras, nunca contando desde el extremo del teclado.',
  },
  keysLoading: { en: 'Loading the keyboard.', es: 'Cargando el teclado.' },
  keysEmpty: {
    en: 'This drill was given no keys to ask about.',
    es: 'A este ejercicio no se le dio ninguna tecla sobre la que preguntar.',
  },
  keysCue: { en: 'Which key is marked?', es: '¿Qué tecla está marcada?' },
  keysNote: {
    en: 'A black key has two names and both are right. Which one a score prints depends on the key it is in.',
    es: 'Una tecla negra tiene dos nombres y los dos son correctos. Cuál de ellos imprime una partitura depende de la tonalidad en la que esté.',
  },

  // piano.staff
  staffTitle: { en: 'Name the marked note', es: 'Nombra la nota marcada' },
  staffLead: {
    en: 'Read it from a landmark, not by counting up from middle C. Counting works at rest and fails at tempo.',
    es: 'Léela desde un punto de referencia, no contando hacia arriba desde el do central. Contar funciona en reposo y falla a tempo.',
  },
  staffLoading: { en: 'Loading the stave.', es: 'Cargando el pentagrama.' },
  staffEmpty: {
    en: 'This drill was given no notes to ask about.',
    es: 'A este ejercicio no se le dio ninguna nota sobre la que preguntar.',
  },
  staffCue: { en: 'Name the circled note.', es: 'Nombra la nota rodeada.' },
  pieceEmpty: {
    en: 'The reader could follow no bar of {title}, so there is nothing to ask here.',
    es: 'El lector no pudo seguir ningún compás de {title}, así que aquí no hay nada que preguntar.',
  },
  barAt: { en: '{title}, bar {n}.', es: '{title}, compás {n}.' },
  thatIs: { en: 'That is {cue}.', es: 'Eso es {cue}.' },

  // Where a note sits, for the line a wrong answer is told. The stave has five
  // lines and four spaces, so the nine of them are written out one by one: an
  // ordinal assembled in code is an ordinal in one language, and Spanish wants
  // primera línea beside primer espacio. Off the stave the count is a number,
  // which needs no gender.
  posL1: { en: 'first line', es: 'primera línea' },
  posL2: { en: 'second line', es: 'segunda línea' },
  posL3: { en: 'third line', es: 'tercera línea' },
  posL4: { en: 'fourth line', es: 'cuarta línea' },
  posL5: { en: 'fifth line', es: 'quinta línea' },
  posS1: { en: 'first space', es: 'primer espacio' },
  posS2: { en: 'second space', es: 'segundo espacio' },
  posS3: { en: 'third space', es: 'tercer espacio' },
  posS4: { en: 'fourth space', es: 'cuarto espacio' },
  posJustBelow: {
    en: 'in the space just below the stave',
    es: 'en el espacio justo debajo del pentagrama',
  },
  posJustAbove: {
    en: 'in the space just above the stave',
    es: 'en el espacio justo encima del pentagrama',
  },
  posLedgerBelow: {
    en: 'on ledger line {n} below the stave',
    es: 'en la línea adicional {n} por debajo del pentagrama',
  },
  posLedgerAbove: {
    en: 'on ledger line {n} above the stave',
    es: 'en la línea adicional {n} por encima del pentagrama',
  },
  posUnderLedgerBelow: {
    en: 'in the space below ledger line {n}, under the stave',
    es: 'en el espacio debajo de la línea adicional {n}, bajo el pentagrama',
  },
  posOverLedgerAbove: {
    en: 'in the space above ledger line {n}, over the stave',
    es: 'en el espacio encima de la línea adicional {n}, sobre el pentagrama',
  },
  barsNote: {
    en: 'Every bar here was read out of the engraving of {title}. The reader drops any bar it cannot follow, so what you were shown is what the score prints.',
    es: 'Cada compás de aquí se leyó de la partitura grabada de {title}. El lector descarta cualquier compás que no pueda seguir, así que lo que viste es lo que imprime la partitura.',
  },
  notesNote: {
    en: 'Accidentals are drawn where the score would print one, and the key signature carries the rest.',
    es: 'Las alteraciones se dibujan donde la partitura imprimiría una, y la armadura carga con el resto.',
  },

  // The clef, written on the stave in place of a glyph that most system fonts
  // do not carry. It has to fit the 42 units before the key signature starts,
  // which "clave de sol" does not, so the drawn word is the short form a
  // Spanish score reader uses out loud and the full name is what the picture
  // hands a screen reader below.
  clefTreble: { en: 'treble', es: 'sol' },
  clefBass: { en: 'bass', es: 'fa' },
  clefNameTreble: { en: 'treble', es: 'clave de sol' },
  clefNameBass: { en: 'bass', es: 'clave de fa' },

  // What a drawing is to somebody who cannot see it. The prompt of these two
  // drills is the picture, so this is the question rather than a decoration.
  ariaBar: {
    en: 'one bar of {count} notes on the {clef} stave, with note {at} marked',
    es: 'un compás de {count} notas en el pentagrama en {clef}, con la nota {at} marcada',
  },
  ariaNote: {
    en: 'one note on the {clef} stave',
    es: 'una nota en el pentagrama en {clef}',
  },
  ariaKeyboard: {
    en: 'one octave of a keyboard with one key marked',
    es: 'una octava de un teclado con una tecla marcada',
  },
});

/**
 * One chrome string, in the reader's language.
 * @param {(v: *) => string} t the shell's resolver, api.t
 * @param {string} key a STRINGS key
 * @param {Object<string, *>} [vars] {name} placeholder values
 * @returns {string}
 */
export function say(t, key, vars) {
  const entry = STRINGS[key];
  if (!entry) return key;
  let out = typeof t === 'function' ? t(entry) : '';
  if (typeof out !== 'string' || out === '') out = entry.en;
  if (vars) {
    for (const name of Object.keys(vars)) {
      const v = vars[name];
      out = out.split(`{${name}}`).join(v === null || v === undefined ? '' : String(v));
    }
    // A piece title can end in its own full stop ("Old French Song."), and the
    // sentence around it would then end in two. Keep the value's mark, drop ours.
    out = out.replace(/([.!?])\.(?=\s|$)/g, '$1');
  }
  return out;
}

/** The clef's word for the stave (short) or for a screen reader (full). */
export function clefWord(t, clef, kind = 'short') {
  const which = clef === 'bass' ? 'Bass' : 'Treble';
  return say(t, kind === 'name' ? `clefName${which}` : `clef${which}`);
}
