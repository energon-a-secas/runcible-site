/**
 * sync.js: the brokered Convex client interface for Runcible. Contract C7.1.
 *
 * Imported by the shell, never edited by it. A signature change here is a
 * three-way edit that travels through delivery-lead (C7.8).
 *
 * Three things to know before calling anything:
 *
 * 1. It is dormant by default. With no <meta name="clerk-publishable-key"> on
 *    the page, every function returns the "no account" result below and NOTHING
 *    is fetched: no Clerk, no Convex, no esm.sh. The client import is dynamic
 *    and lives inside the guard, unlike memes-site/js/state.js:7 which imports
 *    it statically at module top level and pays for it on every anonymous load.
 * 2. Nothing throws. A network failure, a missing vendored auth client, a
 *    malformed document: all of them return a result, because the shell is
 *    local-first and a sync failure must never cost the learner a chapter.
 * 3. pull() runs before push() on sign-in, always, inside this file, so the
 *    read path is exercised on the happy path rather than never. The repo has
 *    shipped a sync script that pushed for months with nothing reading back.
 */

/** The dev deployment. Public, per C7.7: a Convex URL is not a secret. */
const CONVEX_URL = 'https://knowing-pheasant-276.convex.cloud';

/** Pinned, matching this project's convex dependency. Fetched only when a Clerk key is present. */
const CONVEX_CLIENT = 'https://esm.sh/convex@1.43.0/browser';

/** Vendored by packages/neorgon-ui/sync-auth.sh. Absent until that has run. */
const AUTH_CLIENT = './vendor/neorgon-auth.js';

/** Function names, C7.5. Strings at runtime, so there is no build step. */
const FN = {
  whoami: 'sync:whoami',
  pull: 'progress:pull',
  push: 'progress:push',
  clear: 'progress:clear',
};

/** Rows per mutation. The server refuses more than 500 in one call. */
const CHUNK = 200;

/** No account, or no Clerk key on the page. Returned by push and pushBatch. */
const NO_ACCOUNT_WRITE = { ok: false, error: 'no-account', wrote: 0 };

/** No account, or no Clerk key on the page. Returned by clearRemote. */
const NO_ACCOUNT_OK = { ok: false, error: 'no-account' };

let client = null;
let scope = { bookId: null };
let hooks = {};
let auth = { signedIn: false, subject: null };
const listeners = new Set();

function warn(...args) {
  console.warn('Runcible sync:', ...args);
}

function clerkKey() {
  return document.querySelector('meta[name="clerk-publishable-key"]')?.content?.trim() || '';
}

function num(x) {
  return Number.isFinite(Number(x)) ? Number(x) : 0;
}

function chunk(rows, size) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function setAuth(signedIn, subject) {
  auth = { signedIn, subject };
  for (const fn of listeners) {
    try {
      fn({ ...auth });
    } catch (err) {
      warn('an onAuthChange listener threw', err);
    }
  }
}

/** True when the page carries a clerk-publishable-key meta. C7.2. */
export function syncAvailable() {
  return clerkKey().length > 0;
}

/**
 * Start sync. Safe to call with no account: it returns null and touches the
 * network zero times.
 *
 * @param {object} [opts]
 * @param {string} [opts.bookId] scope for pull, push and clearRemote.
 * @param {string|Element} [opts.signInHost] where Clerk mounts its sign-in form.
 * @param {string|Element} [opts.userButtonHost] where Clerk mounts the account button.
 * @param {(remote: object|null) => object|null} [opts.applyRemote] merge the
 *        server document into local state on sign-in and return what to push back.
 * @param {() => object|null} [opts.readLocal] used when applyRemote is absent or
 *        returns nothing: the local { chapters, evidence, prefs } to push.
 * @param {(r: {pulled: object|null, pushed: object|null}) => void} [opts.onSync]
 * @returns {Promise<{signedIn: boolean, subject: string|null}|null>} null when dormant.
 *
 * The returned state is what is known at that instant. A restored session
 * resolves a moment later, so read sign-in state from onAuthChange rather than
 * from this return value.
 */
export async function initSync(opts = {}) {
  scope = { bookId: typeof opts.bookId === 'string' ? opts.bookId : null };
  hooks = {
    applyRemote: opts.applyRemote,
    readLocal: opts.readLocal,
    onSync: opts.onSync,
  };

  const pk = clerkKey();
  if (!pk) return null; // dormant. No import, no request, no error.

  try {
    const { ConvexHttpClient } = await import(CONVEX_CLIENT);
    client = new ConvexHttpClient(CONVEX_URL);
    const { initNeorgonClerkConvex } = await import(AUTH_CLIENT);
    await initNeorgonClerkConvex({
      convex: client,
      publishableKey: pk,
      signInHost: opts.signInHost,
      userButtonHost: opts.userButtonHost,
      // js/router.js owns location.hash; Clerk's default hash routing would
      // rewrite it on every sign-in step and the shell would repaint mid-form.
      signInProps: { routing: 'virtual' },
      onSession: ({ hasSession }) => {
        void onSession(hasSession);
      },
    });
    return { ...auth };
  } catch (err) {
    warn('init failed, staying local-only', err);
    client = null;
    return null;
  }
}

/** Sign-in and sign-out. The subject comes from the server, never from Clerk. */
async function onSession(hasSession) {
  if (!hasSession) {
    if (auth.signedIn) setAuth(false, null);
    return;
  }
  let subject = null;
  try {
    const who = await client.query(FN.whoami, {});
    subject = who?.subject ?? null;
  } catch (err) {
    warn('whoami failed', err);
  }
  if (!subject) {
    setAuth(false, null);
    return;
  }
  if (auth.subject === subject) return;
  setAuth(true, subject);
  await mergeOnSignIn();
}

/** C7.6: read first, then write. Not the other way round, and not optional. */
async function mergeOnSignIn() {
  const pulled = await pull();
  let outgoing = null;
  try {
    if (typeof hooks.applyRemote === 'function') outgoing = await hooks.applyRemote(pulled);
    if (!outgoing && typeof hooks.readLocal === 'function') outgoing = await hooks.readLocal();
  } catch (err) {
    warn('merging the server document into local state failed', err);
  }
  const pushed = outgoing ? await push(outgoing) : null;
  if (typeof hooks.onSync === 'function') {
    try {
      hooks.onSync({ pulled, pushed });
    } catch (err) {
      warn('an onSync listener threw', err);
    }
  }
}

/**
 * The server's progress for the scoped book, or null with no account.
 * Shape: { chapters: [], evidence: [], prefs: [] }. Prefs are not book-scoped.
 */
export async function pull() {
  if (!client || !auth.signedIn || !scope.bookId) return null;
  try {
    const res = await client.query(FN.pull, { bookId: scope.bookId });
    if (!res || res.ok === false) return null;
    if (res.truncated) warn('the server has more rows than one pull returns');
    return { chapters: res.chapters, evidence: res.evidence, prefs: res.prefs };
  } catch (err) {
    warn('pull failed', err);
    return null;
  }
}

function chapterRows(list) {
  return (list || []).map((c) => ({
    chapterId: String(c.chapterId ?? ''),
    state: String(c.state ?? 'available'),
    override: c.override === true,
    rungs: typeof c.rungs === 'string' ? c.rungs : JSON.stringify(c.rungs ?? {}),
    updatedAt: num(c.updatedAt) || Date.now(),
  }));
}

function evidenceRows(list) {
  return (list || []).map((e) => ({
    skill: String(e.skill ?? ''),
    attempts: num(e.attempts),
    correct: num(e.correct),
    recent: typeof e.recent === 'string' ? e.recent : JSON.stringify(e.recent ?? []),
    updatedAt: num(e.updatedAt) || Date.now(),
  }));
}

function prefRows(list) {
  return (list || []).map((p) => ({
    key: String(p.key ?? ''),
    value: typeof p.value === 'string' ? p.value : JSON.stringify(p.value ?? null),
    updatedAt: num(p.updatedAt) || Date.now(),
  }));
}

/**
 * Write progress. Chapters and prefs are per-row last-write-wins by updatedAt.
 *
 * Evidence is the one row type the server SUMS (C7.6), so an evidence row here
 * must carry the attempts accumulated since the last successful push, not the
 * running total: a running total pushed twice would be counted twice. Use
 * pushBatch() for the ordinary path, which builds that delta for you.
 *
 * @param {{chapters?: object[], evidence?: object[], prefs?: object[]}} doc
 */
export async function push(doc) {
  if (!client || !auth.signedIn) return { ...NO_ACCOUNT_WRITE };
  if (!scope.bookId) return { ok: false, error: 'no-book-scope', wrote: 0 };
  if (!doc || typeof doc !== 'object') return { ok: false, error: 'not-a-progress-document', wrote: 0 };

  const chapters = chapterRows(doc.chapters);
  const evidence = evidenceRows(doc.evidence);
  const prefs = prefRows(doc.prefs);

  let wrote = 0;
  try {
    for (const batch of chunk(chapters, CHUNK)) {
      const res = await client.mutation(FN.push, { bookId: scope.bookId, chapters: batch });
      if (!res?.ok) return { ok: false, error: res?.error || 'push-failed', wrote };
      wrote += res.wrote;
    }
    for (const batch of chunk(evidence, CHUNK)) {
      const res = await client.mutation(FN.push, { bookId: scope.bookId, evidence: batch });
      if (!res?.ok) return { ok: false, error: res?.error || 'push-failed', wrote };
      wrote += res.wrote;
    }
    for (const batch of chunk(prefs, CHUNK)) {
      const res = await client.mutation(FN.push, { bookId: scope.bookId, prefs: batch });
      if (!res?.ok) return { ok: false, error: res?.error || 'push-failed', wrote };
      wrote += res.wrote;
    }
    return { ok: true, wrote };
  } catch (err) {
    warn('push failed', err);
    return { ok: false, error: 'push-threw', wrote };
  }
}

/**
 * Fold a batch of C2.3 attempt records into skill evidence deltas and write
 * them. This is the ordinary path: call it with the attempts recorded since the
 * last call and never with the same batch twice, because the server adds.
 *
 * `correct: null` attempts are recorded by the shell but graded by nothing, so
 * they count toward neither `attempts` nor `correct` here, matching C3.4.
 *
 * @param {object[]} entries
 */
export async function pushBatch(entries) {
  if (!client || !auth.signedIn) return { ...NO_ACCOUNT_WRITE };
  const bySkill = new Map();
  for (const row of entries || []) {
    const skill = row?.skill;
    if (!skill || row.correct === null || row.correct === undefined) continue;
    if (!bySkill.has(skill)) bySkill.set(skill, { attempts: 0, correct: 0, flags: [], at: 0 });
    const acc = bySkill.get(skill);
    acc.attempts += 1;
    if (row.correct === true) acc.correct += 1;
    acc.flags.push(row.correct === true ? 1 : 0);
    acc.at = Math.max(acc.at, num(row.at));
  }
  if (!bySkill.size) return { ok: true, wrote: 0 };

  const rows = [...bySkill].map(([skill, acc]) => ({
    skill,
    attempts: acc.attempts,
    correct: acc.correct,
    recent: JSON.stringify(acc.flags),
    updatedAt: acc.at || Date.now(),
  }));
  return await push({ evidence: rows });
}

/**
 * Delete every chapter and evidence row for the scoped book. Prefs survive:
 * they are keyed by (subject, key) with no book, and clearing one book must not
 * drop the visitor's language and track.
 */
export async function clearRemote() {
  if (!client || !auth.signedIn) return { ...NO_ACCOUNT_OK };
  if (!scope.bookId) return { ok: false, error: 'no-book-scope' };
  let deleted = 0;
  try {
    for (let pass = 0; pass < 20; pass++) {
      const res = await client.mutation(FN.clear, { bookId: scope.bookId });
      if (!res?.ok) return { ok: false, error: res?.error || 'clear-failed', deleted };
      deleted += res.deleted;
      if (!res.remaining) return { ok: true, deleted };
    }
    return { ok: false, error: 'clear-incomplete', deleted };
  } catch (err) {
    warn('clearRemote failed', err);
    return { ok: false, error: 'clear-threw', deleted };
  }
}

/**
 * Subscribe to sign-in and sign-out. Called immediately with the current state,
 * so a caller never has to ask separately.
 * @param {(s: {signedIn: boolean, subject: string|null}) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onAuthChange(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  try {
    fn({ ...auth });
  } catch (err) {
    warn('an onAuthChange listener threw', err);
  }
  return () => listeners.delete(fn);
}
