// The Today view's composer: one lesson, the reviews that are due, and one game.
//
// It answers "what do I do now" without the learner deciding, which the study
// structure research names as the value of a prerequisite-ordered ladder. It is
// also the screen where the manual override is surfaced (C3.4), so a learner can
// see which gates they opened themselves and that those chapters are still not
// passed.
//
// Nothing here names a subject. A lesson is the first available chapter, a game
// is a graded exercise from a chapter that is already open, and a review is a
// deck the engine told us was due. Which rung the bookmark is on and which drill
// is the game are js/next-up.js's, which the chapter view asks too, so the rail
// and Today cannot disagree about where a learner stopped.

import { loadChapter, loadLadder, cachedChapters, LoadError, engine } from './books.js';
import { ladder, weakSkills, weakItems, deckCounts, overrides } from './progress.js';
import { isGraded, firstUnfinishedRung, pickGame } from './next-up.js';

/** The page's registry lookup, which js/next-up.js reads a module's graded flag through. */
const implOf = (id) => engine().exerciseImpl(id);

/**
 * Compose the Today view. Loads at most one chapter file: the next lesson's.
 * Everything else comes from what is already cached and from stored progress.
 */
export async function composeToday(book) {
  const rows = ladder(book, await loadLadder(book));
  const open = rows.filter((r) => r.state === 'available');
  const passed = rows.filter((r) => r.state === 'passed');
  // A chapter with no goal.evidence (a study plan, a stub) is available for
  // ever, so it would become the permanent next lesson once its neighbours
  // pass; the next lesson is the first open chapter that can be passed.
  const next = open.find((r) => r.doc && r.doc.goal && r.doc.goal.evidence) || open[0] || null;

  let nextDoc = null;
  let nextError = null;
  if (next) {
    try {
      nextDoc = await loadChapter(book, next.id);
    } catch (e) {
      nextError = e instanceof LoadError ? e.message : String(e && e.message);
    }
  }

  const reachable = new Set([...open, ...passed].map((r) => r.id));
  const pool = [];
  for (const doc of cachedChapters(book.id)) {
    if (!reachable.has(doc.id)) continue;
    for (const rung of doc.rungs || []) {
      for (const ex of rung.exercises || []) {
        if (isGraded(ex, implOf)) pool.push({ chapterId: doc.id, rungId: rung.id, exercise: ex });
      }
    }
  }

  return {
    rows,
    next,
    nextDoc,
    nextError,
    nextRung: nextDoc ? firstUnfinishedRung(book.id, nextDoc, implOf) : null,
    reviews: reviewsFor(book, pool),
    game: pickGame(book.id, pool),
    overrides: overrides(book.id).map((id) => rows.find((r) => r.id === id)).filter(Boolean),
    allPassed: rows.length > 0 && rows.every((r) => r.state === 'passed' || r.state === 'planned'),
  };
}

/**
 * What is due. Deck counts come from the engine's own rappel:due events, cached
 * by embed.js, because the host does not own the ledger and cannot compute them
 * (C6.2). Weak skills come from the attempt log.
 */
function reviewsFor(book, pool) {
  const counts = deckCounts(book.id);
  const decks = [];
  for (const item of pool) {
    if (item.exercise.type !== 'deck') continue;
    const seen = counts[item.exercise.src];
    if (!seen || !(seen.due > 0)) continue;
    decks.push({ ...item, due: seen.due, new: seen.new, at: seen.at });
  }
  decks.sort((a, b) => b.due - a.due);
  return { decks, skills: weakSkills(book.id, 3), items: weakItems(book.id, 6) };
}
