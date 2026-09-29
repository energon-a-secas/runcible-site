// What comes next: the rung the bookmark sits on, the drill a chapter offers
// as Next up, and the day's drill. Today, the rail and the facing page all ask
// here, so the three cannot disagree about where a learner stopped.
//
// It is also the one reader of an exercise's `optional: true`. An optional
// exercise is drawn where the chapter put it, runs, and records its attempts
// like any other; it is never what decides "next" or "done". A rung is
// finished by its other drills, Next up passes over it while the rung has
// anything else to offer, and it is never the day's drill. The field exists
// because a Book that adds a drill to rungs a learner has already finished
// must not send that learner back to them: C1.4 lets a Book add an optional
// field, and adding one drill at the head of seven finished rungs moved every
// such bookmark back to the first of them, with nothing on screen saying why.
//
// Nothing here touches the DOM or fetches, so node runs this file as it is
// (tools/next-up.test.mjs). A custom module's `graded: false` lives in the
// page's exercise registry, which cannot be imported without a document, so
// every caller hands in `implOf`, the registry's own exerciseImpl lookup.

import { exerciseState, weakSkills } from './progress.js';
import { GENERIC_TYPES, NEVER_GRADED } from './exercises/index.js';

/**
 * Types that grade: every generic type the engine knows except the two C2.1
 * says record correct: null (read and speak). Derived rather than listed,
 * because the hand list here missed `quiz` when it became the tenth type, so
 * every rung whose drills were Quiz rounds read as finished: Today, the
 * bookmark and Next up all skipped them and started a fresh Book on rung 2.
 */
const GRADED = GENERIC_TYPES.filter((type) => !NEVER_GRADED.includes(type));

/** With no registry to ask, a custom module grades, as one that omits the flag does. */
const noImpl = () => null;

/** Only the boolean counts: validateExerciseSpec refuses any other value. */
export function isOptional(ex) {
  return !!ex && ex.optional === true;
}

/**
 * Does this exercise grade. A custom module grades unless it said
 * `graded: false` when it registered, so Today never offers an ungraded module
 * as the day's drill or counts it as one.
 */
export function isGraded(ex, implOf = noImpl) {
  if (!ex || !GRADED.includes(ex.type)) return false;
  if (ex.type !== 'custom') return true;
  const impl = implOf(ex.module);
  return !(impl && impl.graded === false);
}

/** The drills a rung is finished by: the graded ones that are not optional. */
export function countsTowardDone(ex, implOf = noImpl) {
  return isGraded(ex, implOf) && !isOptional(ex);
}

/**
 * The first rung whose counted drills are not all finished, else the first
 * rung. A rung with nothing counted (pages only, or only optional drills) is
 * never where the bookmark stops.
 */
export function firstUnfinishedRung(bookId, doc, implOf = noImpl) {
  for (const rung of doc.rungs || []) {
    const counted = (rung.exercises || []).filter((ex) => countsTowardDone(ex, implOf));
    if (!counted.length) continue;
    if (counted.some((ex) => !exerciseState(bookId, doc.id, ex.id))) return rung;
  }
  return (doc.rungs || [])[0] || null;
}

/**
 * The one drill a rung offers as Next up: the first one not yet finished, else
 * the first. Optional drills are passed over while the rung holds any other,
 * so a rung made only of optional ones still has a Next up.
 */
export function nextDrill(bookId, chapterId, drills) {
  const all = drills || [];
  const counted = all.filter((ex) => !isOptional(ex));
  const from = counted.length ? counted : all;
  return from.find((ex) => !exerciseState(bookId, chapterId, ex.id)) || from[0] || null;
}

/**
 * One game from a pool of { chapterId, rungId, exercise }: a graded exercise
 * from a chapter the learner can already open, preferring whichever practises
 * their weakest skill. "Weakest" is measured, so on a first visit with no
 * attempts this is simply the first drill available. Decks are reviews, not
 * games, and an optional exercise is never the day's drill.
 */
export function pickGame(bookId, pool) {
  const playable = pool.filter((item) => item.exercise.type !== 'deck' && !isOptional(item.exercise));
  if (!playable.length) return null;
  for (const row of weakSkills(bookId, 5)) {
    const hit = playable.find((item) => item.exercise.skill === row.skill);
    if (hit) return { ...hit, because: row };
  }
  const fresh = playable.find((item) => !exerciseState(bookId, item.chapterId, item.exercise.id));
  return fresh ? { ...fresh, because: null } : { ...playable[0], because: null };
}
