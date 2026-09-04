// Shared state, and the two localStorage keys.
//
// Both go through the vendored Persist Kit (js/neorgon-persist.js, canonical
// source packages/neorgon-ui/persist/persist.js), so private browsing and a
// full quota degrade to a returned false instead of throwing on the boot path.
// Keys are frozen in CONTRACTS C8.2 and are never spelled anywhere else:
//
//   runcible:prefs:v1      { lang, track, bookId, reduceMotion, ttsVoice, seenIntro }
//   runcible:progress:v1   { books: { <bookId>: { chapters, evidence, decks } } }
//
// C8.5: neither project is published, so this is the only free moment to get
// these right. A rename after launch orphans everything a visitor saved.

import { createStore, storageAvailable } from './neorgon-persist.js';
import { initSync, pull, push, pushBatch, clearRemote, onAuthChange } from './sync.js';
import { debounce } from './utils.js';

export const PREFS_KEY = 'runcible:prefs:v1';
export const PROGRESS_KEY = 'runcible:progress:v1';

/** C8.2: evidence windows are capped at 200 attempts per skill. */
export const EVIDENCE_CAP = 200;

const DEFAULT_PREFS = {
  lang: 'en',
  track: null,
  bookId: null,
  reduceMotion: false,
  ttsVoice: null,
  seenIntro: false,
};

const prefsStore = createStore({ key: PREFS_KEY, version: 1 });
const progressStore = createStore({ key: PROGRESS_KEY, version: 1 });

export const state = {
  prefs: { ...DEFAULT_PREFS },
  progress: { books: {} },
  storage: true,

  catalog: null,   // books/index.json, once loaded
  book: null,      // the open Book manifest, plus { dir }
  chapter: null,   // the open chapter document
  route: null,     // { name, params } from router.js
  busy: false,
  error: null,     // { message, detail } shown instead of the view
};

/** Read both stores. Called once, first thing in app.js. */
export function loadSaved(s = state) {
  s.storage = storageAvailable();
  const prefs = prefsStore.load(null);
  if (prefs && typeof prefs === 'object') s.prefs = { ...DEFAULT_PREFS, ...prefs };
  const progress = progressStore.load(null);
  if (progress && progress.books && typeof progress.books === 'object') s.progress = progress;
  return s;
}

export const savePrefs = debounce(() => {
  prefsStore.save(state.prefs);
  void pushPrefs();
}, 150);
export const saveProgress = debounce(() => {
  progressStore.save(state.progress);
  void pushProgress();
}, 250);

/** Set one preference and persist. */
export function setPref(key, value) {
  if (!(key in DEFAULT_PREFS)) throw new Error('unknown pref: ' + key);
  if (state.prefs[key] === value) return;
  state.prefs[key] = value;
  if (SYNCED_PREFS.has(key)) _prefsAt = Date.now();
  // The open Book is the sync scope, and C12 A2 sets a scope at init, so a
  // change of Book re-inits rather than being passed to pull() or push().
  if (key === 'bookId') void scopeSyncTo(value);
  savePrefs();
}

/** The progress slot for a Book, created on first touch. */
export function bookSlot(bookId) {
  if (!bookId) throw new Error('bookSlot needs a bookId');
  const books = state.progress.books || (state.progress.books = {});
  if (!books[bookId]) books[bookId] = { chapters: {}, evidence: {}, decks: {} };
  const slot = books[bookId];
  if (!slot.chapters) slot.chapters = {};
  if (!slot.evidence) slot.evidence = {};
  if (!slot.decks) slot.decks = {};
  return slot;
}

/** The progress row for one chapter, created on first touch. */
export function chapterRow(bookId, chapterId) {
  const slot = bookSlot(bookId);
  if (!slot.chapters[chapterId]) {
    slot.chapters[chapterId] = { override: false, rungs: {}, exercises: {}, updatedAt: 0 };
  }
  return slot.chapters[chapterId];
}

/** Drop every local row for one Book. */
export function resetBook(bookId) {
  if (state.progress.books) delete state.progress.books[bookId];
  // Deltas for a Book that no longer exists locally must not be sent: they
  // would recreate on the server what the learner just deleted.
  _unpushed = _unpushed.filter((a) => a.bookId !== bookId);
  saveProgress();
  // A local-only reset is undone by the next sign-in merge, so the server copy
  // goes with it. C7.5 progress:clear; prefs are not book-scoped and survive.
  if (_signedIn && bookId === _scoped) void clearRemote();
}

// ── Sync bridge: C7.1, C7.6, and amendments C12 A1, A2 and A5 ────────────────
//
// sync.js belongs to workstream D. It is imported and never edited (C7.8), and
// three of its properties shape everything below.
//
// C12 A2: pull(), push() and clearRemote() are scoped by initSync({ bookId }),
// not by arguments of their own, and for Runcible that scope is REQUIRED.
// Unscoped, pull() returns null and push() returns
// { ok: false, error: 'no-book-scope' }. A Book becoming the open Book is
// therefore a re-init, and it happens in one place: setPref('bookId'), which
// openBook() calls.
//
// C12 A1, the dangerous one: an evidence row is a DELTA. The server SUMS
// attempts and correct whenever its own row is older, so a running lifetime
// total pushed twice is counted twice. Attempt counts inflate, C3.4's
// goal.evidence then passes chapters nobody earned, and no error is raised
// anywhere. Evidence therefore leaves this module by exactly one route:
// pushBatch(), fed from _unpushed, which holds the attempts recorded since the
// last push the server acknowledged. No push() document assembled here ever
// carries an evidence array.
//
// C12 A5: with no account nothing throws and nothing is fetched. initSync()
// returns null, pull() returns null, push() and pushBatch() return
// { ok: false, error: 'no-account', wrote: 0 }, clearRemote() returns
// { ok: false, error: 'no-account' }, and onAuthChange() calls back at once
// with { signedIn: false, subject: null } and returns an unsubscribe. So the
// whole bridge is a no-op on an anonymous load.
//
// DESIGN 6.2: pull() runs before push() on sign-in, always, because this repo
// already shipped a sync script that pushed for months with nothing reading
// back and the drift was invisible until something checked. initSync() owns
// that ordering now, which is why the merge hangs off its applyRemote hook
// instead of a pull() call of our own.

/** The prefs C7.3's prefs table names: lang, track, reduceMotion. */
const SYNCED_PREFS = new Set(['lang', 'track', 'reduceMotion']);

let _signedIn = false;
let _scoped = null;    // the bookId initSync() is scoped to
let _syncBooted = false;
let _repaint = null;   // render(), called when a merge changes what is on screen
let _prefsAt = 0;      // when a synced pref last changed on this device
let _unpushed = [];    // attempts the server has not acknowledged

/**
 * Queue one attempt as an evidence delta. Called by progress.js on every
 * recorded attempt, signed in or not, so that signing in mid-session does not
 * lose the attempts that came before it.
 *
 * `correct: null` attempts are queued rather than filtered here: pushBatch()
 * applies C3.4's rule that an ungraded attempt counts toward nothing, and one
 * definition of "graded" is enough.
 */
export function queueAttempt(record) {
  if (!record || !record.skill || !record.bookId) return;
  _unpushed.push({ bookId: record.bookId, skill: record.skill, correct: record.correct, at: record.at });
}

/** Chapter rows for one Book. Per-row LWW by updatedAt, so re-sending is free. */
function chapterRows(bookId) {
  const slot = bookSlot(bookId);
  return Object.entries(slot.chapters).map(([chapterId, row]) => ({
    chapterId,
    state: row.state || 'available',
    override: !!row.override,
    rungs: JSON.stringify(row.rungs || {}),
    updatedAt: row.updatedAt || 0,
  }));
}

/**
 * Pref rows, stamped with when the pref actually changed rather than with now.
 * Stamping every push with Date.now() would make this device's stale value beat
 * another device's fresh one on every progress save, which is LWW in form and
 * last-writer-to-do-anything-at-all in effect.
 */
function prefRows() {
  if (!_prefsAt) return [];
  return [...SYNCED_PREFS]
    .filter((key) => state.prefs[key] !== null && state.prefs[key] !== undefined)
    .map((key) => ({ key, value: String(state.prefs[key]), updatedAt: _prefsAt }));
}

/**
 * The local document to send. Chapters and prefs only.
 *
 * Evidence is deliberately absent (C12 A1). This device cannot know which of
 * its lifetime attempts the server has already counted, and the server adds,
 * so the only honest thing to send in a whole-document push is nothing at all.
 * The delta queue takes over from this moment forward.
 */
function readLocal() {
  if (!_scoped) return null;
  return { chapters: chapterRows(_scoped), prefs: prefRows() };
}

/** Merge a server document into local progress. Per-row last write wins, C7.6. */
export function mergeRemote(bookId, remote) {
  if (!remote) return false;
  const slot = bookSlot(bookId);
  for (const row of remote.chapters || []) {
    const local = chapterRow(bookId, row.chapterId);
    if ((row.updatedAt || 0) <= (local.updatedAt || 0)) continue;
    local.override = !!row.override;
    local.state = row.state;
    local.updatedAt = row.updatedAt || 0;
    try { local.rungs = JSON.parse(row.rungs || '{}'); } catch { local.rungs = {}; }
  }
  for (const row of remote.evidence || []) {
    const local = slot.evidence[row.skill] || [];
    const localAt = local.length ? local[local.length - 1].at : 0;
    if ((row.updatedAt || 0) <= localAt) continue;
    let recent = [];
    try { recent = JSON.parse(row.recent || '[]'); } catch { recent = []; }
    if (!Array.isArray(recent)) continue;
    // C12 A18: the wire carries one 0/1 flag per attempt, oldest first, and
    // local evidence carries C2.3 records. Each flag becomes a record with the
    // one field the gate reads (correct) and nothing it cannot know: no itemId,
    // so weakItems skips it, and the row's own timestamp for ordering.
    const at = row.updatedAt || Date.now();
    const records = recent.map((v) => {
      if (v === 1 || v === 0) return { at, itemId: null, skill: row.skill, correct: v === 1, ms: 0, source: 'sync' };
      if (v && typeof v === 'object' && typeof v.correct === 'boolean') return v;
      return null;
    }).filter(Boolean);
    if (!records.length) continue;
    slot.evidence[row.skill] = records.slice(-EVIDENCE_CAP);
  }
  for (const row of remote.prefs || []) {
    if (!SYNCED_PREFS.has(row.key)) continue;
    if ((row.updatedAt || 0) <= _prefsAt) continue;
    state.prefs[row.key] = row.key === 'reduceMotion' ? row.value === 'true' : row.value;
    _prefsAt = row.updatedAt || 0;
  }
  return true;
}

/** initSync's merge hook: apply the server document, then say what to send back. */
function applyRemote(remote) {
  if (!_scoped) return null;
  if (mergeRemote(_scoped, remote)) {
    progressStore.save(state.progress);
    prefsStore.save(state.prefs);
    if (_repaint) _repaint();
  }
  return readLocal();
}

/**
 * Send the queued evidence deltas.
 *
 * The batch is taken out of the queue synchronously, before the first await, so
 * two overlapping flushes hold disjoint batches and no attempt can be sent
 * twice. Sending one twice is exactly the C12 A1 corruption, because the server
 * adds rather than replaces.
 */
async function flushEvidence() {
  if (!_signedIn || !_scoped) return;
  const batch = _unpushed.filter((a) => a.bookId === _scoped);
  if (!batch.length) return;
  _unpushed = _unpushed.filter((a) => a.bookId !== _scoped);
  const res = await pushBatch(batch);
  // A summed ledger has no self-healing: an unacknowledged delta is lost for
  // good unless it is retried, so it goes back on the queue. sync.js has
  // already logged why the write failed; this is not swallowing that.
  if (!res || res.ok !== true) _unpushed = batch.concat(_unpushed);
}

async function pushProgress() {
  if (!_signedIn || !_scoped) return;
  await push({ chapters: chapterRows(_scoped) });
  await flushEvidence();
}

async function pushPrefs() {
  if (!_signedIn || !_scoped) return;
  const prefs = prefRows();
  if (prefs.length) await push({ prefs });
}

/**
 * Point sync at a Book. C12 A2: this is the only way pull() and push() learn
 * their scope, and without it they refuse with 'no-book-scope'.
 */
export async function scopeSyncTo(bookId) {
  // No Book yet is still a reason to mount: a visitor who has not opened one
  // would otherwise see the account button with an empty sheet behind it.
  // pull() and push() refuse with no-book-scope until a Book is chosen.
  const next = bookId || null;
  if (_syncBooted && next === _scoped) return null;
  _syncBooted = true;
  const wasSignedIn = _signedIn;
  _scoped = next;
  const res = await initSync({
    bookId: next || undefined,
    signInHost: '#neorgon-signin-mount',
    userButtonHost: '#neorgon-user-mount',
    applyRemote,
    readLocal,
    onSync: () => { void flushEvidence(); },
  });
  // Switching Book inside a signed-in session re-scopes a client that is
  // already mounted, and sync.js only runs its sign-in merge when the subject
  // changes, so nothing would read the new scope. Pull for it explicitly.
  // Merging is idempotent (per-row LWW, and an evidence window is replaced
  // rather than added to), so the cost of doing it twice is one request.
  if (wasSignedIn && _signedIn && next) {
    const outgoing = applyRemote(await pull());
    if (outgoing) await push(outgoing);
    await flushEvidence();
  }
  return res;
}

/**
 * Wire sync. Called once from app.js, before the first paint, so that a merge
 * arriving early has somewhere to repaint. Returns the unsubscribe C12 A5
 * pins, which nothing uses yet and which exists so a caller is not forced to
 * leak a listener.
 */
export function initSyncBridge(onChange) {
  _repaint = typeof onChange === 'function' ? onChange : null;
  // Sign-in and sign-out move a flag and repaint, nothing more. The merge
  // belongs to applyRemote, so there is one merge path rather than two racing.
  const off = onAuthChange((auth) => {
    const was = _signedIn;
    _signedIn = !!(auth && auth.signedIn);
    if (was !== _signedIn && _repaint) _repaint();
  });
  void scopeSyncTo(state.prefs.bookId);
  return off;
}
