// ── The Runcible exercise engine ─────────────────────────────
// Contract C2, version runcible-exercise/1. Workstream A1b.
//
// This is the whole seam. The shell imports from here and from nowhere else
// under js/exercises/; a Book never imports from here at all, it receives the
// frozen runcible object the shell builds and hands to its register function.
//
// createExerciseRegistry() is the entry point. It returns an instance rather
// than a module singleton so a harness, a test and the shell each hold their
// own, and one run cannot leak registrations into the next. js/books.js keeps
// the page's single instance.
//
// See ./README.md for what the shell provides and what each type expects from a
// chapter file.

export { createExerciseRegistry, EXERCISE_VERSION } from './registry.js';
export {
  GENERIC_TYPES, REQUIRED_FIELDS, NEVER_GRADED, QUIZ_FILTER_FIELDS,
  validateExerciseSpec, checkRegisteredId, parseQuizFilter,
} from './spec.js';
export { ExerciseError, locate } from './errors.js';

// Grading helpers, exported so a Book module can grade the way the generic
// types do rather than inventing a second notion of a correct string.
export { DEFAULT_COMPARE, COMPARE_TOKENS, parseCompare, normalise, isCorrect } from './compare.js';

// Speech. C2.5 lives in speech.js: getVoices() is async on Chrome and every
// path here waits for voiceschanged. `tts` is the body the shell should use for
// api.tts, so the page has one speech path and one voiceschanged listener.
export {
  tts, speak, cancelSpeech, loadVoices, voicesFor, hasVoiceFor,
  synthAvailable, recognitionAvailable, listenOnce,
} from './speech.js';
