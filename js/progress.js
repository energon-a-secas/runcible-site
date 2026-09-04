// Attempts, skill evidence, and chapter unlocking. Contracts C2.3 and C3.4.
//
// Every graded thing in this product ends here. An exercise calls api.attempt(),
// the Rappel embed converts a rappel:answer into the same call, and this module
// is the only writer of the evidence windows that decide what is unlocked.

import { state, bookSlot, chapterRow, saveProgress, queueAttempt, EVIDENCE_CAP } from './state.js';

/** How many recent graded attempts define "weak" when no goal says otherwise. */
const WEAK_WINDOW = 20;

/**
 * Record one attempt. C2.3.
 *
 * The caller supplies { itemId, skill, correct, ms, answer?, expected?,
 * hintUsed? } and the shell appends { at, bookId, chapterId, exerciseId,
 * source }. source is 'shell' or 'rappel'; nothing else is legal.
 *
 * Required fields are checked loudly. An exercise that silently records a
 * malformed attempt stops a chapter unlocking and reports nothing, which is
 * the failure mode C6.7 warns about, so it throws instead.
 */
export function recordAttempt(input, ctx) {
  const a = input || {};
  const where = (ctx && ctx.exerciseId) || 'unknown exercise';
  if (!a.itemId || typeof a.itemId !== 'string') throw new Error(`attempt from ${where}: itemId is required and must be a string`);
  if (!a.skill || typeof a.skill !== 'string') throw new Error(`attempt from ${where}: skill is required and must be a dotted string`);
  if (!(a.correct === true || a.correct === false || a.correct === null)) {
    throw new Error(`attempt from ${where}: correct must be true, false or null`);
  }
  if (!Number.isFinite(a.ms)) throw new Error(`attempt from ${where}: ms is required and must be a number`);
  const source = (ctx && ctx.source) || 'shell';
  if (source !== 'shell' && source !== 'rappel') throw new Error(`attempt from ${where}: source must be shell or rappel`);

  const bookId = (ctx && ctx.bookId) || state.prefs.bookId;
  if (!bookId) throw new Error(`attempt from ${where}: no book is open`);

  const record = {
    at: Date.now(),
    itemId: a.itemId,
    skill: a.skill,
    correct: a.correct,
    ms: Math.round(a.ms),
    bookId,
    chapterId: (ctx && ctx.chapterId) || null,
    exerciseId: (ctx && ctx.exerciseId) || null,
    source,
  };
  if (a.answer !== undefined) record.answer = String(a.answer);
  if (a.expected !== undefined) record.expected = String(a.expected);
  if (a.hintUsed) record.hintUsed = true;

  const slot = bookSlot(bookId);
  const list = slot.evidence[a.skill] || (slot.evidence[a.skill] = []);
  list.push(record);
  if (list.length > EVIDENCE_CAP) list.splice(0, list.length - EVIDENCE_CAP);
  // C12 A1: the server sums evidence, so it is told about this one attempt and
  // never about the running total the line above maintains. The two are
  // different numbers on purpose, and confusing them inflates attempt counts
  // until chapters unlock themselves.
  queueAttempt(record);

  if (record.chapterId) {
    const row = chapterRow(bookId, record.chapterId);
    row.updatedAt = record.at;
  }
  saveProgress();
  return record;
}

/** Every stored attempt for a skill, oldest first. */
export function attemptsFor(bookId, skill) {
  const slot = bookSlot(bookId);
  return slot.evidence[skill] || [];
}

/**
 * Is a goal's evidence satisfied? C3.4:
 *
 *   "over the most recent `window` attempts carrying `skill`, at least `min`
 *    attempts exist and at least `accuracy` of them were correct.
 *    correct: null attempts count toward nothing, so clicking through pages
 *    never passes a chapter."
 *
 * "Count toward nothing" is read strictly: an ungraded attempt does not enter
 * the window at all. The alternative reading, where nulls occupy window slots
 * and push graded attempts out, would let a learner lock themselves out of a
 * chapter by re-reading its pages. Recorded here because the contract sentence
 * admits both readings and this one is the humane half of the pair.
 */
export function evidenceStatus(bookId, evidence) {
  const out = { ok: false, graded: 0, correct: 0, accuracy: 0, min: 0, window: 0, need: 0 };
  if (!evidence || !evidence.skill) return out;
  out.min = Number(evidence.min) || 0;
  out.window = Number(evidence.window) || out.min;
  const target = Number(evidence.accuracy) || 0;
  const graded = attemptsFor(bookId, evidence.skill).filter((a) => a.correct === true || a.correct === false);
  const recent = out.window > 0 ? graded.slice(-out.window) : graded;
  out.graded = recent.length;
  out.correct = recent.filter((a) => a.correct === true).length;
  out.accuracy = out.graded ? out.correct / out.graded : 0;
  out.need = Math.max(0, out.min - out.graded);
  out.target = target;
  out.ok = out.graded >= out.min && out.min > 0 && out.accuracy >= target;
  return out;
}

/** The requires list for a chapter under the current track. C1.3 rule 3. */
export function requiresFor(book, chapter) {
  const req = chapter.requires;
  if (!req) return [];
  if (Array.isArray(req)) return req;
  const track = currentTrack(book);
  if (!Object.prototype.hasOwnProperty.call(req, track)) {
    // A load error naming the chapter, not a guess. C1.3 rule 3 makes the
    // object form keyed by track id, and a missing key is a broken manifest.
    throw new Error(`chapter ${chapter.id}: requires has no entry for track "${track}"`);
  }
  const list = req[track];
  return Array.isArray(list) ? list : [];
}

/** The selected track id, or the manifest's default. */
export function currentTrack(book) {
  const tracks = (book && book.tracks) || [];
  const chosen = state.prefs.track;
  if (chosen && tracks.some((tr) => tr.id === chosen)) return chosen;
  const def = tracks.find((tr) => tr.default) || tracks[0];
  return def ? def.id : 'default';
}

/**
 * The goal for a chapter. It lives in the chapter file, not in the manifest
 * entry (C3.1), so every call that decides state takes the loaded documents.
 */
function goalOf(entry, docs) {
  const doc = docs && docs.get ? docs.get(entry.id) : null;
  return (doc && doc.goal) || entry.goal || null;
}

/** A chapter with no goal.evidence cannot gate the next one. C9.3 rule 2. */
function gates(goal) {
  return !!(goal && goal.evidence && goal.evidence.skill);
}

/**
 * 'passed' | 'available' | 'locked'. C3.4.
 *
 * Completion is never sufficient: passed is decided by evidence alone. A
 * locked chapter is opened by the manual override, which makes it available
 * and never makes it passed, so an override can never cascade.
 */
export function chapterState(book, entry, docs) {
  const bookId = book.id;
  const row = chapterRow(bookId, entry.id);
  const goal = goalOf(entry, docs);
  if (gates(goal) && evidenceStatus(bookId, goal.evidence).ok) return 'passed';
  if (row.override) return 'available';
  const req = requiresFor(book, entry);
  const byId = new Map((book.chapters || []).map((c) => [c.id, c]));
  for (const id of req) {
    const dep = byId.get(id);
    if (!dep) throw new Error(`chapter ${entry.id}: requires unknown chapter "${id}"`);
    // A required chapter whose file did not load has no goal to read, and
    // "no goal" must not read as "nothing to pass": the gate stays shut until
    // the file loads, rather than opening because a fetch failed.
    if (dep.src && !(docs && docs.get && docs.get(dep.id))) return 'locked';
    const depGoal = goalOf(dep, docs);
    if (!gates(depGoal)) continue;
    if (!evidenceStatus(bookId, depGoal.evidence).ok) return 'locked';
  }
  return 'available';
}

/**
 * The ladder: every chapter with its state, in manifest order.
 * The goal block lives in the chapter file, so the manifest entry is merged
 * with whatever of that file is already loaded.
 */
export function ladder(book, docs) {
  return (book.chapters || []).map((entry) => {
    const row = chapterRow(book.id, entry.id);
    const planned = entry.state === 'planned' || entry.src === null;
    const goal = goalOf(entry, docs);
    let st = 'locked';
    let err = null;
    try {
      st = planned ? 'planned' : chapterState(book, entry, docs);
    } catch (e) {
      err = e.message;
    }
    return {
      entry,
      doc: (docs && docs.get ? docs.get(entry.id) : null) || null,
      id: entry.id,
      state: err ? 'locked' : st,
      error: err,
      override: !!row.override,
      evidence: gates(goal) ? evidenceStatus(book.id, goal.evidence) : null,
    };
  });
}

/** The manual override. C3.4: visible, recorded, and surfaced in Today. */
export function setOverride(bookId, chapterId, on) {
  const row = chapterRow(bookId, chapterId);
  row.override = !!on;
  row.updatedAt = Date.now();
  saveProgress();
  return row;
}

/** Chapter ids the learner opened without the evidence. */
export function overrides(bookId) {
  const slot = bookSlot(bookId);
  return Object.entries(slot.chapters)
    .filter(([, row]) => row.override)
    .map(([id]) => id);
}

/** Skills sorted by recent accuracy, weakest first. Ungraded attempts ignored. */
export function weakSkills(bookId, limit = 3) {
  const slot = bookSlot(bookId);
  const rows = [];
  for (const [skill, list] of Object.entries(slot.evidence)) {
    const graded = list.filter((a) => a.correct === true || a.correct === false).slice(-WEAK_WINDOW);
    if (!graded.length) continue;
    const correct = graded.filter((a) => a.correct === true).length;
    rows.push({ skill, graded: graded.length, correct, accuracy: correct / graded.length });
  }
  rows.sort((a, b) => a.accuracy - b.accuracy);
  return rows.slice(0, limit);
}

/** Item ids answered wrong most recently, newest first, deduplicated. */
export function weakItems(bookId, limit = 8) {
  const slot = bookSlot(bookId);
  const all = [];
  for (const list of Object.values(slot.evidence)) {
    for (const a of list) if (a.correct === false && a.itemId) all.push(a);
  }
  all.sort((a, b) => b.at - a.at);
  const seen = new Set();
  const out = [];
  for (const a of all) {
    if (seen.has(a.itemId)) continue;
    seen.add(a.itemId);
    out.push(a);
    if (out.length >= limit) break;
  }
  return out;
}

/** Cache what the embedded engine last reported for a deck. C6.2 rappel:due. */
export function noteDeckCounts(bookId, src, counts) {
  const slot = bookSlot(bookId);
  slot.decks[src] = { ...counts, at: Date.now() };
  saveProgress();
}

/** Deck counts last reported by the engine, by deck src. */
export function deckCounts(bookId) {
  return bookSlot(bookId).decks || {};
}

/** Mark an exercise finished, for the tick beside it. C3.4: not the chapter gate. */
export function markExercise(bookId, chapterId, exerciseId, result) {
  const row = chapterRow(bookId, chapterId);
  const prev = row.exercises[exerciseId] || {};
  const accuracy = Number.isFinite(result && result.accuracy) ? result.accuracy : null;
  // A skipped exercise and a crashed one report through the same hook and
  // must not render as a finished tick.
  const finished = !(result && (result.skipped || result.error));
  if (!finished && !prev.done) return prev;
  row.exercises[exerciseId] = {
    done: finished || !!prev.done,
    best: accuracy === null ? (prev.best ?? null) : Math.max(prev.best ?? 0, accuracy),
    at: Date.now(),
  };
  row.updatedAt = Date.now();
  saveProgress();
  return row.exercises[exerciseId];
}

/** What the learner has finished inside one chapter. */
export function exerciseState(bookId, chapterId, exerciseId) {
  return chapterRow(bookId, chapterId).exercises[exerciseId] || null;
}

/** Note that a rung's pages were seen. Completion, which never passes a chapter. */
export function markRung(bookId, chapterId, rungId) {
  const row = chapterRow(bookId, chapterId);
  row.rungs[rungId] = { seen: true, at: Date.now() };
  row.updatedAt = Date.now();
  saveProgress();
}
