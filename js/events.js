// Every listener in the site. There are no inline handlers anywhere: h() throws
// on an attribute starting with "on", so a stray onclick cannot be added by
// accident, and index.html carries none.
//
// One delegated click handler covers the whole app. Views are rebuilt wholesale
// by render(), so per-node listeners would have to be re-attached on every
// paint, and one of them would eventually be missed.

import { state, setPref, resetBook } from './state.js';
import { render, startExercise } from './render.js';
import { setOverride } from './progress.js';
import { start } from './router.js';
import { showToast } from './utils.js';
import { ui } from './i18n.js';
import { syncAvailable, onAuthChange } from './sync.js';

/** data-action -> handler. The dataset carries the arguments. */
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
  'reset-book': (d) => {
    resetBook(d.book);
    showToast(ui('resetDone'));
    return render();
  },
};

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const handler = ACTIONS[el.dataset.action];
  if (!handler) return;
  e.preventDefault();
  Promise.resolve()
    .then(() => handler(el.dataset))
    .catch((err) => {
      console.error('[runcible]', err);
      showToast(err.message || String(err));
    });
}

/** Bind everything. Called once from app.js. */
export function bindEvents() {
  document.addEventListener('click', onClick);
  const langBtn = document.getElementById('langToggle');
  if (langBtn) langBtn.setAttribute('data-action', 'toggle-lang');
  // The account button (C7.2) stays hidden with no Clerk key on the page, so a
  // visitor with no account never meets a dead control. Clerk owns the sheet's
  // contents; this only opens and closes it.
  const authBtn = document.getElementById('authToggle');
  const authPanel = document.getElementById('authPanel');
  if (authBtn && authPanel) {
    authBtn.hidden = !syncAvailable();
    authPanel.hidden = authBtn.hidden;
    authBtn.addEventListener('click', () => {
      const open = !authPanel.classList.contains('open');
      authPanel.classList.toggle('open', open);
      authBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    onAuthChange((auth) => authBtn.classList.toggle('logged-in', !!(auth && auth.signedIn)));
  }
  // The router owns the paint: every view change goes through the hash, so a
  // deep link and a click follow the same path.
  start((route) => {
    state.route = route;
    render();
  });
}
