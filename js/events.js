// Every listener in the site. There are no inline handlers anywhere: h() throws
// on an attribute starting with "on", so a stray onclick cannot be added by
// accident, and index.html carries none.
//
// One delegated click handler covers the whole app. Views are rebuilt wholesale
// by render(), so per-node listeners would have to be re-attached on every
// paint, and one of them would eventually be missed.

import { state, setPref, resetBook } from './state.js';
import { render, startExercise, closeExercise, scrollToId, setPending } from './render.js';
import { setOverride } from './progress.js';
import { start, go } from './router.js';
import { showToast } from './utils.js';
import { ui } from './i18n.js';

/** Close the contents disclosure, which is only ever open below the rail width. */
function closeContents() {
  for (const bar of document.querySelectorAll('.rn-rail-bar[aria-expanded="true"]')) {
    bar.setAttribute('aria-expanded', 'false');
    const rail = bar.closest('.rn-rail');
    if (rail) delete rail.dataset.open;
  }
}

/** data-action -> handler(dataset, element). The dataset carries the arguments. */
const ACTIONS = {
  'toggle-lang': () => {
    setPref('lang', state.prefs.lang === 'en' ? 'es' : 'en');
    document.documentElement.lang = state.prefs.lang;
    return render();
  },
  'set-lang': (d) => {
    setPref('lang', d.lang === 'es' ? 'es' : 'en');
    document.documentElement.lang = state.prefs.lang;
    return render();
  },
  'set-track': (d) => {
    setPref('track', d.track);
    return render();
  },
  'override-on': (d) => {
    // C3.4. Recorded, reversible, and surfaced in Today so the learner can see
    // what they skipped.
    setOverride(state.book.id, d.chapter, true);
    showToast(ui('opened'));
    return render();
  },
  'override-off': (d) => {
    setOverride(state.book.id, d.chapter, false);
    return render();
  },
  'start-exercise': (d) => startExercise(d.chapter, d.exercise),
  'close-exercise': () => closeExercise(),
  // The rail is one nav in one markup: a sticky column from 1180px, a 40px bar
  // with a disclosure below it. The disclosure pushes the page down, so there
  // is nothing to trap focus in and nothing to dismiss on Escape.
  'toggle-contents': (d, el) => {
    const rail = el.closest('.rn-rail');
    const open = el.getAttribute('aria-expanded') !== 'true';
    el.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (rail) {
      if (open) rail.dataset.open = 'on';
      else delete rail.dataset.open;
    }
  },
  'scroll-to': (d) => {
    closeContents();
    scrollToId(d.target, 'start');
  },
  // Today's two ways back into the book: to the rung the reader stopped at, and
  // straight into a drill. Both are one hash change plus a job for the paint
  // that follows it, because the target does not exist until the chapter draws.
  'open-rung': (d) => {
    setPending({ target: `rung-${d.rung}` });
    go('chapter', { bookId: d.book, chapterId: d.chapter });
  },
  'open-exercise': (d) => {
    setPending({ target: `marker-${d.exercise}`, start: { chapter: d.chapter, exercise: d.exercise } });
    go('chapter', { bookId: d.book, chapterId: d.chapter });
  },
  'reset-book': (d) => {
    resetBook(d.book);
    showToast(ui('resetDone'));
    return render();
  },
};

/**
 * Escape closes a running drill. It is the second way out, beside the Close
 * button the marker and the facing bar carry, and the one a keyboard reader
 * reaches for first.
 *
 * A text field keeps its own Escape: the shipping Book is Japanese, and Escape
 * inside an IME cancels the conversion in progress. Closing the drill out from
 * under that would lose the half-typed answer to a key the learner pressed at
 * the IME, not at us. Those drills still show Close on the marker.
 */
function onKeydown(e) {
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
  if (!document.body.dataset.exerciseOpen) return;
  const active = document.activeElement;
  if (active && active.closest && active.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
  e.preventDefault();
  closeExercise();
}

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const handler = ACTIONS[el.dataset.action];
  if (!handler) return;
  e.preventDefault();
  Promise.resolve()
    .then(() => handler(el.dataset, el))
    .catch((err) => {
      console.error('[runcible]', err);
      showToast(err.message || String(err));
    });
}

/** Bind everything. Called once from app.js. */
export function bindEvents() {
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);
  const langBtn = document.getElementById('langToggle');
  if (langBtn) langBtn.setAttribute('data-action', 'toggle-lang');
  // The account control (C7.2) is the Neorgon Auth Kit's header slot, which the
  // kit wires itself once js/sync.js starts it, so nothing is bound here for it.
  // The router owns the paint: every view change goes through the hash, so a
  // deep link and a click follow the same path.
  start((route) => {
    state.route = route;
    render();
  });
}
