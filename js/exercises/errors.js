// ── Load errors ──────────────────────────────────────────────
// C2.4 requires an unregistered transform id to be "a load error naming the
// chapter and the exercise". Everything that can be wrong in a chapter file is
// raised through here, so every one of them says where it is. A stack trace
// pointing at registry.js tells an author nothing; "chapter 3-intervals,
// exercise e-thirds-type" tells them the file and the line to open.

function idOf(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.id === 'string') return value.id;
  return null;
}

/**
 * Human readable location. Any part may be missing: the shell passes what it
 * knows, and an exercise mounted from a fixture knows only its own id.
 *
 * The context is read in both spellings on purpose. C2 never froze it, so the
 * shell passes whole objects ({ book, chapter, exercise }) where the engine's
 * own callers pass ids ({ bookId, chapterId }). Reading either is not a
 * fallback, it is one function that can name a chapter from either spelling,
 * and C2.4 requires the chapter to be named.
 *
 * @param {object} [ctx]
 * @param {{id?: string, type?: string}} [spec]
 * @returns {string}
 */
export function locate(ctx, spec) {
  const c = ctx || {};
  const s = spec || {};
  const parts = [];
  const book = c.bookId || idOf(c.book);
  const chapter = c.chapterId || idOf(c.chapter);
  const rung = c.rungId || idOf(c.rung);
  if (book) parts.push(`book ${book}`);
  if (chapter) parts.push(`chapter ${chapter}`);
  if (rung) parts.push(`rung ${rung}`);
  const exercise = s.id || idOf(c.exercise);
  if (exercise) parts.push(`exercise ${exercise}`);
  else if (s.type) parts.push(`an untitled ${s.type} exercise`);
  return parts.length ? parts.join(', ') : 'an exercise with no id';
}

/** An error in a chapter file, a Book module, or a call into the engine. */
export class ExerciseError extends Error {
  constructor(message, ctx, spec) {
    const where = locate(ctx, spec);
    super(`${message} (${where})`);
    this.name = 'ExerciseError';
    this.where = where;
    this.detail = message;
  }
}
