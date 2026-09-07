// ── The registry ─────────────────────────────────────────────
// One registry per shell. It holds the ten generic types, whatever a Book
// registers on top of them, and the single mount() the shell calls.
//
// The object a Book receives is frozen and carries exactly three things
// (C2.2): registerExercise, registerTransform, version. There is no path from
// it to the registry map, to the shell, or to another Book.

import { ExerciseError } from './errors.js';
import { GENERIC_TYPES, validateExerciseSpec, checkRegisteredId, checkTransformId } from './spec.js';
import { mountWith as mountCustom } from './types/custom.js';
import * as read from './types/read.js';
import * as choice from './types/choice.js';
import * as typed from './types/typed.js';
import * as match from './types/match.js';
import * as order from './types/order.js';
import * as listen from './types/listen.js';
import * as speak from './types/speak.js';
import * as deck from './types/deck.js';
import * as quiz from './types/quiz.js';

/** The wire version of this interface. C2's version string. */
export const EXERCISE_VERSION = 'runcible-exercise/1';

const GENERIC = Object.freeze({ read, choice, typed, match, order, listen, speak, deck, quiz });

/** Types whose spec may name a transform (C2.4). */
const TAKES_TRANSFORM = Object.freeze(['typed', 'listen']);

export function createExerciseRegistry() {
  /** id -> { impl, bookId } */
  const exercises = new Map();
  /** id -> { fn, bookId } */
  const transforms = new Map();

  function scopeFor(bookId, provides) {
    const allowedExercises = provides && Array.isArray(provides.exercises) ? provides.exercises : [];
    const allowedTransforms = provides && Array.isArray(provides.transforms) ? provides.transforms : [];
    const seenExercises = [];
    const seenTransforms = [];

    function guard(kind, id, allowed) {
      // C12 A10: the dot rule is an exercise id rule. A transform id is free
      // form, because C2.4 ships no transforms for one to shadow, and requiring
      // a dot refused C1.2's own ["kana", "kana-katakana"].
      const problem = kind === 'exercise' ? checkRegisteredId(id) : checkTransformId(id);
      if (problem) throw new ExerciseError(`Book "${bookId}" tried to register ${kind} ${problem}`, { bookId });
      if (!allowed.includes(id)) {
        throw new ExerciseError(
          `Book "${bookId}" registered ${kind} "${id}" without declaring it. ` +
          `C1 rule 4: a module registers exactly what its modules[].provides.${kind}s array lists, ` +
          `which here is ${allowed.length ? allowed.map((a) => `"${a}"`).join(', ') : 'nothing'}`,
          { bookId });
      }
    }

    const runcible = Object.freeze({
      version: EXERCISE_VERSION,
      registerExercise(id, impl) {
        guard('exercise', id, allowedExercises);
        if (!impl || typeof impl.mount !== 'function') {
          throw new ExerciseError(`exercise "${id}" was registered with no mount(host, spec, api)`, { bookId });
        }
        exercises.set(id, { impl, bookId });
        seenExercises.push(id);
      },
      registerTransform(id, fn) {
        guard('transform', id, allowedTransforms);
        if (typeof fn !== 'function') {
          throw new ExerciseError(`transform "${id}" was registered with something that is not a function`, { bookId });
        }
        transforms.set(id, { fn, bookId });
        seenTransforms.push(id);
      },
    });

    function assertComplete() {
      const missingE = allowedExercises.filter((id) => !seenExercises.includes(id));
      const missingT = allowedTransforms.filter((id) => !seenTransforms.includes(id));
      if (missingE.length || missingT.length) {
        const bits = [];
        if (missingE.length) bits.push(`exercises ${missingE.join(', ')}`);
        if (missingT.length) bits.push(`transforms ${missingT.join(', ')}`);
        throw new ExerciseError(
          `Book "${bookId}" declares ${bits.join(' and ')} but its module registered neither`, { bookId });
      }
    }

    return { runcible, assertComplete };
  }

  /**
   * Run one Book module. The shell does the import, because it owns the URL;
   * this takes the default export and holds it to the manifest's declaration.
   *
   * @param {{ bookId: string, path?: string, register: function, provides?: object }} entry
   * @returns {{ exercises: string[], transforms: string[] }} what it registered
   */
  function registerBookModule(entry) {
    const { bookId, path, register, provides } = entry || {};
    if (typeof register !== 'function') {
      throw new ExerciseError(
        `the module ${path || '(unnamed)'} of Book "${bookId}" has no default exported register(runcible) function`,
        { bookId });
    }
    const { runcible, assertComplete } = scopeFor(bookId, provides);
    register(runcible);
    assertComplete();
    return {
      exercises: (provides && provides.exercises) || [],
      transforms: (provides && provides.transforms) || [],
    };
  }

  /**
   * Register outside a Book module scope.
   *
   * This is the surface the shell uses (js/books.js), because it already holds
   * the manifest and already enforces C1 rule 4 against modules[].provides
   * before it gets here. What is enforced here is only what the shell cannot
   * know: the C2.2 id rules, and that an implementation has a mount.
   *
   * Both checks agree with the shell's, which is deliberate. A registration
   * that got past one and not the other would mean the two disagree about what
   * a legal id is, and that is worth finding at registration rather than never.
   */
  function registerExercise(id, impl) {
    const problem = checkRegisteredId(id);
    if (problem) throw new ExerciseError(`cannot register exercise ${problem}`);
    if (!impl || typeof impl.mount !== 'function') {
      throw new ExerciseError(`exercise "${id}" was registered with no mount(host, spec, api)`);
    }
    exercises.set(id, { impl, bookId: null });
  }

  function registerTransform(id, fn) {
    if (checkTransformId(id)) {
      throw new ExerciseError('cannot register a transform with no id');
    }
    if (typeof fn !== 'function') {
      throw new ExerciseError(`transform "${id}" was registered with something that is not a function`);
    }
    transforms.set(id, { fn, bookId: null });
  }

  /** Drop everything a Book contributed. Called when the shell switches Book. */
  function resetBook(bookId) {
    for (const [id, v] of Array.from(exercises)) if (v.bookId === bookId) exercises.delete(id);
    for (const [id, v] of Array.from(transforms)) if (v.bookId === bookId) transforms.delete(id);
  }

  function listTransforms() { return Array.from(transforms.keys()); }
  function listExercises() { return Array.from(exercises.keys()); }
  function getTransform(id) { const e = transforms.get(id); return e ? e.fn : null; }

  /**
   * Mount an exercise into a host element the exercise owns entirely.
   *
   * @param {HTMLElement} host
   * @param {object} spec the exercise object from the chapter file
   * @param {object} api the frozen { attempt, t, lang, data, tts, done }
   * @param {{bookId?: string, chapterId?: string, rungId?: string}} [ctx]
   * @returns {{ destroy: function }}
   */
  function mount(host, spec, api, ctx) {
    const where = ctx || {};
    if (!host) throw new ExerciseError('mount() was given no host element', where, spec);
    if (!spec || typeof spec !== 'object') throw new ExerciseError('mount() was given no exercise spec', where, spec);
    if (!api || typeof api.attempt !== 'function') {
      throw new ExerciseError('mount() needs an api with attempt(). C2.3 is the whole point', where, spec);
    }

    const problems = validateExerciseSpec(spec, {
      transforms: listTransforms(),
      modules: listExercises(),
    });
    if (problems.length) {
      throw new ExerciseError(problems.join('; '), where, spec);
    }

    if (spec.type === 'custom') {
      const entry = exercises.get(spec.module);
      if (!entry) {
        throw new ExerciseError(
          `no Book module registered "${spec.module}". Registered here: ` +
          `${listExercises().length ? listExercises().join(', ') : 'nothing'}`, where, spec);
      }
      return mountCustom(entry.impl, host, spec, api, where);
    }

    let resolved = spec;
    if (spec.transform !== undefined && TAKES_TRANSFORM.includes(spec.type)) {
      const fn = getTransform(spec.transform);
      if (!fn) {
        // C2.4: "An unregistered id is a load error naming the chapter and the
        // exercise." ExerciseError does the naming.
        throw new ExerciseError(
          `"transform": "${spec.transform}" is not registered. The shell ships no transforms, ` +
          `and this Book registered ${listTransforms().length ? listTransforms().join(', ') : 'none'}`,
          where, spec);
      }
      resolved = Object.assign({}, spec, { transformFn: fn });
    }

    const type = GENERIC[spec.type];
    if (!type) throw new ExerciseError(`"${spec.type}" has no implementation in this build`, where, spec);
    return type.mount(host, resolved, api, where);
  }

  function reset() { exercises.clear(); transforms.clear(); }

  return Object.freeze({
    version: EXERCISE_VERSION,
    types: GENERIC_TYPES,
    registerExercise,
    registerTransform,
    registerBookModule,
    resetBook,
    reset,
    listTransforms,
    listExercises,
    getTransform,
    /** Can this engine mount an exercise of this type or module id. */
    hasExercise: (id) => GENERIC_TYPES.includes(id) || exercises.has(id),
    /** A registered module's implementation, for its declared flags (graded). */
    exerciseImpl: (id) => (exercises.get(id) || {}).impl || null,
    validateSpec: (spec) => validateExerciseSpec(spec, {
      transforms: listTransforms(),
      modules: listExercises(),
    }),
    mount,
  });
}
