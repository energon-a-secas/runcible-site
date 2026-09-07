// The catalog as a shelf, and a Book as its contents page.
//
// No cards and no progress bars here. A Book is one line on the shelf; a
// chapter is one line of the contents with its statement under it, the state
// glyph in the margin, and the evidence sentence on hover and focus (title).

import { t, ui } from './i18n.js';
import { h } from './utils.js';
import { href } from './router.js';
import * as books from './books.js';
import * as progress from './progress.js';
import { action, textAction, stateGlyph, evidenceSentence, titleOf } from './render-shared.js';

const BOOK_STATE = { ready: 'bookReady', soon: 'bookSoon', planned: 'planned', draft: 'bookDraft', stub: 'bookStub' };

/** The shelf: glyph, title, tagline when the index carries one, and state. */
export async function catalogView() {
  const catalog = await books.loadCatalog();
  const rows = (catalog.books || []).map((b) => {
    const planned = b.state === 'planned';
    const title = t(b.title);
    return h('li', { class: planned ? 'rn-shelf-row rn-shelf-row--planned' : 'rn-shelf-row' }, [
      h('span', { class: 'rn-shelf-glyph', 'aria-hidden': 'true' }, b.glyph),
      h('div', { class: 'rn-shelf-text' }, [
        planned
          ? h('span', { class: 'rn-shelf-title' }, title)
          : h('a', { class: 'rn-shelf-title', href: href('book', { bookId: b.id }) }, title),
        b.tagline ? h('p', { class: 'rn-shelf-tag' }, t(b.tagline)) : null,
      ]),
      h('span', { class: 'rn-shelf-state' }, ui(BOOK_STATE[b.state] || 'planned')),
    ]);
  });
  return [
    h('h2', { class: 'rn-title' }, ui('shelf')),
    h('ul', { class: 'rn-shelf' }, rows),
  ];
}

/** Tracks as a segmented control, with the chosen track's one line under it. */
export function trackPicker(book) {
  const tracks = book.tracks || [];
  if (tracks.length < 2) return null;
  const current = progress.currentTrack(book);
  const chosen = tracks.find((tr) => tr.id === current) || {};
  const buttons = tracks.map((tr) => {
    const b = action(t(tr.label), 'set-track', { track: tr.id }, 'rn-seg-btn');
    b.setAttribute('aria-pressed', String(tr.id === current));
    return b;
  });
  return h('div', { class: 'rn-tracks' }, [
    h('div', { class: 'rn-seg', role: 'group', 'aria-label': ui('track') }, buttons),
    h('p', { class: 'rn-lead' }, t(chosen.description)),
  ]);
}

export async function bookView(bookId) {
  const book = await books.openBook(bookId);
  const docs = await books.loadLadder(book);
  const rows = progress.ladder(book, docs);
  return [
    h('header', { class: 'rn-book-head' }, [
      h('span', { class: 'rn-book-glyph', 'aria-hidden': 'true' }, book.glyph),
      h('div', { class: 'rn-book-titles' }, [
        h('h2', { class: 'rn-chapter-title' }, t(book.title)),
        h('p', { class: 'rn-goal' }, t(book.goal) || t(book.tagline)),
      ]),
    ]),
    trackPicker(book),
    h('ol', { class: 'rn-contents', 'aria-label': ui('chapters') }, rows.map((row) => contentsRow(book, row))),
  ];
}

function contentsRow(book, row) {
  const doc = row.doc;
  const title = titleOf(row);
  const statement = doc ? t(doc.goal && doc.goal.statement) : t(row.entry.note);
  const ev = evidenceSentence(row.evidence) || null;
  const openable = row.state === 'available' || row.state === 'passed';
  const head = openable
    ? h('a', { class: 'rn-contents-title', href: href('chapter', { bookId: book.id, chapterId: row.id }), title: ev }, title)
    : h('span', { class: 'rn-contents-title', title: ev }, title);
  return h('li', { class: 'rn-contents-row', 'data-state': row.state }, [
    stateGlyph(row.state),
    h('div', { class: 'rn-contents-text' }, [
      h('div', { class: 'rn-contents-head' }, [head, row.override ? h('span', { class: 'rn-contents-note' }, ui('opened')) : null]),
      statement ? h('p', { class: 'rn-contents-statement' }, statement) : null,
      row.error ? h('p', { class: 'rn-warn' }, row.error) : null,
      // C3.4: every locked chapter carries a visible manual override, in the
      // rail's muted treatment. On the accent it was the loudest element on
      // the page, seven rows running, which is the wrong thing to shout.
      row.state === 'locked'
        ? textAction(ui('openAnyway'), 'override-on', { chapter: row.id }, 'rn-textlink rn-toc-override')
        : null,
    ]),
  ]);
}
