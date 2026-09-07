// The paint loop. Every view lives in a js/render-*.js module; this file owns
// the order of a paint and nothing else.
//
// Content reaches the page as text nodes and attributes only, never as markup:
// h() builds elements and sets textContent, and no file in the shell writes
// innerHTML (C3.3). A chapter is authored by a skill, so the safe path has to
// be the only path.

import { state } from './state.js';
import { ui, beginPage, hadFallback, onFallback, applyChrome } from './i18n.js';
import { h, append, clear } from './utils.js';
import { errorBlock } from './render-shared.js';
import { catalogView, bookView } from './render-contents.js';
import { chapterView } from './render-chapter.js';
import { todayView } from './render-today.js';
import { settingsView } from './render-settings.js';
import { setRepaint, destroyMounted, afterPaint } from './render-mount.js';

export { startExercise, closeExercise, scrollToId, setPending } from './render-mount.js';

const VIEW_ID = 'view';
let token = 0;      // guards against a slow view painting over a new one
let lastKey = '';   // the route the last paint drew, so a repaint does not re-animate

function view() { return document.getElementById(VIEW_ID); }

const VIEWS = {
  today: () => todayView(),
  catalog: () => catalogView(),
  book: (p) => bookView(p.bookId),
  chapter: (p) => chapterView(p.bookId, p.chapterId),
  settings: () => settingsView(),
};

/** The one line the honesty rule owes a Spanish reader. */
function fallbackNote() {
  if (state.prefs.lang === 'en' || !hadFallback()) return null;
  return h('p', { class: 'rn-note rn-note--fallback' }, ui('untranslated'));
}

// An exercise mounts after render() emitted its line, so a late fallback adds it.
onFallback(() => {
  const root = view();
  if (root && root.getAttribute('aria-busy') !== 'true' && !root.querySelector('.rn-note--fallback')) {
    root.appendChild(fallbackNote());
  }
});

/** Rebuild the view for the current route. */
export async function render() {
  const mine = ++token;
  const root = view();
  if (!root) return;
  destroyMounted();
  beginPage();
  applyChrome();
  root.setAttribute('aria-busy', 'true');

  const route = state.route || { name: 'today', params: {} };
  let nodes;
  try {
    nodes = await (VIEWS[route.name] || VIEWS.today)(route.params);
  } catch (e) {
    console.error('[runcible]', e);
    nodes = [errorBlock(e.message, e.file || null)];
  }
  if (mine !== token) return;   // a newer render already started

  // Turning a page is worth 180ms; answering a question and repainting the same
  // page is not, so the entry motion is armed only when the route changed.
  const key = `${route.name}:${JSON.stringify(route.params || {})}`;
  root.classList.toggle('rn-enter', key !== lastKey);
  lastKey = key;
  root.dataset.view = route.name;

  clear(root);
  if (!state.storage) root.appendChild(h('p', { class: 'rn-warn' }, ui('storageOff')));
  append(root, nodes);
  const note = fallbackNote();
  if (note) root.appendChild(note);
  root.removeAttribute('aria-busy');
  await afterPaint(route);
}

setRepaint(render);
