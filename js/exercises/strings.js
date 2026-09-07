// ── The engine's own copy ────────────────────────────────────
// Every learner-facing string the engine draws that is not Book content: the
// Next button, "Correct.", the summary lines, the hint text, the speech
// messages. Book content reaches an exercise through api.t already; this is
// the chrome around it, which used to be English literals scattered across the
// types, so a Spanish reader met a half-translated drill and the shell's
// honesty line never knew.
//
// The shape is the fleet's { en, es } object, resolved by whatever `t` the
// shell handed the exercise (api.t). Resolving through api.t rather than a
// private lookup is the point: the shell's resolver is what records a fallback
// for the honesty line, so a key here that ever lacks Spanish is reported the
// same way untranslated content is. Nothing in this file touches the DOM;
// tools/validate-book.mjs loads the engine under plain node.
//
// {name} placeholders are filled by chrome(); a value is inserted as text and
// never parsed, so a learner's own answer cannot become markup.

export const STRINGS = Object.freeze({
  // session position. A book counts questions and pages, never percentages:
  // the unit is chosen by the type (read counts pages), not by the reader.
  question: { en: 'Question {at} of {total}', es: 'Pregunta {at} de {total}' },
  page: { en: 'Page {at} of {total}', es: 'Página {at} de {total}' },
  summaryGraded: { en: '{right} of {graded} correct.', es: '{right} de {graded} correctas.' },
  summaryUngraded: { en: '{asked} recorded, nothing graded here.', es: '{asked} registradas, aquí no se califica nada.' },
  passed: { en: 'That clears the mark for this drill.', es: 'Eso supera la marca de este ejercicio.' },
  failed: {
    en: 'Below the mark for this drill. Run it again when you want it.',
    es: 'Por debajo de la marca de este ejercicio. Repítelo cuando quieras.',
  },
  continue: { en: 'Continue', es: 'Continuar' },
  couldNotStart: { en: 'This exercise could not start.', es: 'Este ejercicio no pudo empezar.' },
  skipIt: { en: 'Skip it', es: 'Saltarlo' },

  // question frame
  next: { en: 'Next', es: 'Siguiente' },
  back: { en: 'Back', es: 'Atrás' },
  finish: { en: 'Finish', es: 'Terminar' },
  done: { en: 'Done', es: 'Listo' },
  check: { en: 'Check', es: 'Comprobar' },
  hint: { en: 'Hint', es: 'Pista' },
  startsWith: { en: 'It starts with {first}.', es: 'Empieza con {first}.' },
  yourAnswer: { en: 'Your answer', es: 'Tu respuesta' },

  // Options. The keycap beside a row is what the digit key presses; when the
  // options are themselves numbers the label is the key, so there is no cap.
  keyHint: {
    en: 'Press the number beside an option, or use the arrow keys.',
    es: 'Pulsa el número junto a una opción, o usa las flechas.',
  },
  keyHintNumeral: {
    en: 'Press the number you want, or use the arrow keys.',
    es: 'Pulsa el número que quieras, o usa las flechas.',
  },
  keyHintArrows: { en: 'Use the arrow keys, then Enter.', es: 'Usa las flechas y luego Enter.' },

  // grading
  correct: { en: 'Correct.', es: 'Correcto.' },
  // The expected answer is the panel's first line, so these do not repeat it.
  // They used to, which put a long gloss twice on a phone screen and read as
  // the interface stuttering.
  notThatOne: { en: 'Not that one.', es: 'Esa no.' },
  notQuite: { en: 'Not quite.', es: 'No del todo.' },
  notThatOrder: { en: 'Not that order.', es: 'Ese no es el orden.' },

  // The panel under a wrong answer (feedback.js)
  rightAnswer: { en: 'The answer', es: 'La respuesta' },
  because: { en: 'Why', es: 'Por qué' },
  // The Spanish avoids agreeing with a gender the engine cannot know: the
  // thing confused may be una letra or un número depending on the Book.
  notThis: {
    en: 'Not {wrong}, which is easy to confuse with it.',
    es: 'No {wrong}: es fácil confundirlos.',
  },
  chosenIs: { en: 'You picked {answer}, which is {prompt}.', es: 'Elegiste {answer}, que es {prompt}.' },
  chosenPairs: { en: '{answer} goes with {prompt}.', es: '{answer} va con {prompt}.' },
  seeRule: { en: 'See the rule in the chapter', es: 'Ver la regla en el capítulo' },
  bothRight: {
    en: 'Both spellings are right; the dictionary lists both.',
    es: 'Las dos grafías son correctas; el diccionario recoge ambas.',
  },

  // match
  promptColumn: { en: 'Prompts', es: 'Enunciados' },
  answerColumn: { en: 'Answers', es: 'Respuestas' },
  paired: { en: 'Paired', es: 'Emparejados' },
  pairedAs: { en: '{left}: {right}', es: '{left}: {right}' },
  pairThem: { en: 'Pick one from each column to pair them.', es: 'Elige uno de cada columna para emparejarlos.' },
  selected: { en: '{left} selected. Now pick its pair.', es: '{left} seleccionado. Ahora elige su pareja.' },
  pickLeftFirst: { en: 'Pick from the prompts first.', es: 'Elige primero un enunciado.' },
  goesWith: { en: '{left} goes with {right}.', es: '{left} va con {right}.' },
  doesNotGoWith: { en: '{left} does not go with {right}.', es: '{left} no va con {right}.' },
  selectionCleared: { en: 'Selection cleared.', es: 'Selección borrada.' },
  pairsLeft: { en: '{n} still to pair.', es: 'Quedan {n} por emparejar.' },

  // order
  yourArrangement: { en: 'Your arrangement', es: 'Tu orden' },
  tokens: { en: 'Tokens', es: 'Fichas' },
  nothingPlaced: { en: 'Nothing placed yet.', es: 'Todavía no hay nada colocado.' },
  removeToken: { en: 'Remove {token}', es: 'Quitar {token}' },
  placeToken: { en: 'Place {token}', es: 'Colocar {token}' },

  // listen
  playIt: { en: 'Play it', es: 'Reproducir' },
  replayKey: { en: 'Press R to hear it again.', es: 'Pulsa R para oírlo de nuevo.' },
  audioOnlySkipLang: {
    en: 'This drill only asks by playing audio, and this browser has no {lang} voice installed. Skipping it rather than showing a question you cannot answer.',
    es: 'Este ejercicio solo pregunta reproduciendo audio, y este navegador no tiene instalada ninguna voz {lang}. Se salta en lugar de mostrar una pregunta que no puedes responder.',
  },
  audioOnlySkip: {
    en: 'This drill only asks by playing audio, and this browser has no speech voice installed. Skipping it rather than showing a question you cannot answer.',
    es: 'Este ejercicio solo pregunta reproduciendo audio, y este navegador no tiene instalada ninguna voz. Se salta en lugar de mostrar una pregunta que no puedes responder.',
  },
  noVoiceTextLang: {
    en: 'No {lang} voice is installed in this browser, so this drill is showing the text instead of speaking it.',
    es: 'Este navegador no tiene instalada ninguna voz {lang}, así que este ejercicio muestra el texto en lugar de pronunciarlo.',
  },
  noVoiceText: {
    en: 'No speech voice is installed in this browser, so this drill is showing the text instead of speaking it.',
    es: 'Este navegador no tiene instalada ninguna voz, así que este ejercicio muestra el texto en lugar de pronunciarlo.',
  },

  // speak
  sayItAloud: { en: 'Say this out loud. Nothing here is scored.', es: 'Dilo en voz alta. Aquí nada se puntúa.' },
  hearIt: { en: 'Hear it', es: 'Escuchar' },
  noVoiceModelLang: {
    en: 'No {lang} voice is installed in this browser, so there is no model to play. The line above is still worth saying.',
    es: 'Este navegador no tiene instalada ninguna voz {lang}, así que no hay modelo que reproducir. Aun así vale la pena decir la línea de arriba.',
  },
  noVoiceModel: {
    en: 'No speech voice is installed in this browser, so there is no model to play. The line above is still worth saying.',
    es: 'Este navegador no tiene instalada ninguna voz, así que no hay modelo que reproducir. Aun así vale la pena decir la línea de arriba.',
  },
  sayIt: { en: 'Say it', es: 'Decirlo' },
  listening: { en: 'Listening', es: 'Escuchando' },
  listeningNow: { en: 'Listening.', es: 'Escuchando.' },
  heard: { en: 'This browser heard: {transcript}', es: 'Este navegador oyó: {transcript}' },
  ownFeedback: { en: 'Your own feedback, not a score.', es: 'Tu propia retroalimentación, no una puntuación.' },
  micBlocked: {
    en: 'The microphone is blocked for this site. Allow it in the browser\'s site settings, then try again.',
    es: 'El micrófono está bloqueado para este sitio. Permítelo en los ajustes del sitio del navegador y vuelve a intentarlo.',
  },
  heardNothing: {
    en: 'This browser heard nothing it could turn into text. If the microphone is blocked, the browser\'s site settings say so.',
    es: 'Este navegador no oyó nada que pudiera convertir en texto. Si el micrófono está bloqueado, los ajustes del sitio del navegador lo indican.',
  },
  noRecognition: {
    en: 'This browser has no speech recognition, so there is nothing to transcribe. Compare yourself against the model instead.',
    es: 'Este navegador no tiene reconocimiento de voz, así que no hay nada que transcribir. Compárate con el modelo.',
  },

  // read pages
  figureNotDrawn: { en: 'Figure not drawn here: {kind} {src}', es: 'Figura no dibujada aquí: {kind} {src}' },
  figureEmpty: { en: 'This figure page carries no figure.', es: 'Esta página de figura no contiene ninguna figura.' },

  // deck
  deckNotWired: { en: 'This deck is not wired up yet.', es: 'Esta baraja todavía no está conectada.' },
});

/**
 * One chrome string, in the reader's language.
 * @param {(v: *) => string} t the shell's resolver, api.t
 * @param {string} key a STRINGS key
 * @param {Object<string, *>} [vars] {name} placeholder values
 * @returns {string}
 */
export function chrome(t, key, vars) {
  const entry = STRINGS[key];
  if (!entry) return key;
  let out = typeof t === 'function' ? t(entry) : '';
  if (typeof out !== 'string' || out === '') out = entry.en;
  if (vars) {
    for (const name of Object.keys(vars)) {
      const v = vars[name];
      out = out.split(`{${name}}`).join(v === null || v === undefined ? '' : String(v));
    }
    // A gloss can end in its own punctuation ("how do you do?"), and the
    // sentence around it then ends "?.". Keep the value's mark, drop ours.
    out = out.replace(/([.!?。！？])\.(?=\s|$)/g, '$1');
  }
  return out;
}
