// What the page says about where you are, outside the view: the tab title and
// the current link in the header and footer. Called after every paint
// (js/render-mount.js afterPaint), so a language change, a sync merge and a
// route change all land in the same place.
//
// Every route used to leave the title as "Runcible | A book that teaches
// back" and no link marked, so tabs, history and a screen reader could not
// tell Today from a chapter.

import { state } from './state.js';
import { t, ui } from './i18n.js';
import { cachedChapters } from './books.js';

const SITE = 'Runcible';
const DEFAULT_TITLE = 'Runcible | A book that teaches back';

/** The hash each shell route's own link carries, for aria-current. */
const OWN_LINK = { today: '#/', catalog: '#/books', settings: '#/settings' };

/** The open Book, when it is the one the route names. */
function bookFor(params) {
  const book = state.book;
  return book && params && book.id === params.bookId ? book : null;
}

/** A chapter's title from its file when loaded, else its manifest entry, else its id. */
function chapterTitle(book, chapterId) {
  const doc = cachedChapters(book.id).find((d) => d.id === chapterId);
  const entry = (book.chapters || []).find((c) => c.id === chapterId);
  return t(doc && doc.title) || t(entry && entry.title) || chapterId;
}

/** The name this route puts before "| Runcible", or null for the site default. */
function pageName(route) {
  const p = route.params || {};
  if (route.name === 'today') return ui('today');
  if (route.name === 'catalog') return ui('books');
  if (route.name === 'settings') return ui('settings');
  const book = bookFor(p);
  if (route.name === 'book') return book ? t(book.title) : null;
  if (route.name === 'chapter') return book ? chapterTitle(book, p.chapterId) : null;
  return null;
}

/**
 * Set the tab title and aria-current for the route just painted. A view that
 * failed says so in the title too, rather than naming a page that is not there.
 * A route this module does not know keeps the site's default title.
 */
export function paintChrome(route) {
  if (typeof document === 'undefined' || !route) return;
  // reduceMotion is a synced pref (C7.3), so a sign-in merge can change it
  // without a click; the attribute the CSS reads follows it on every paint.
  document.documentElement.toggleAttribute('data-reduce-motion', !!state.prefs.reduceMotion);
  const failed = !!document.querySelector('#view > .rn-error');
  const name = failed ? ui('loadFailed') : pageName(route);
  document.title = name ? `${name} | ${SITE}` : DEFAULT_TITLE;

  const own = OWN_LINK[route.name] || null;
  for (const a of document.querySelectorAll('.header-bar a[href^="#/"], .neo-footer a[href^="#/"]')) {
    if (own && a.getAttribute('href') === own) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}
