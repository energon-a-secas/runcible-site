// Today as the open page: a two-page spread on wide screens, stacked on narrow.
//
// The left page is where you are: chapter, rung, the paragraph the bookmark is
// sitting on, the goal, the evidence sentence, one primary Continue reading.
// The right page is today's work as a short list: the reviews that are due, one
// drill, the rest of that rung, and the chapter's own pages with the bookmark
// hanging into the one you stopped at. The composer is js/today.js; this only
// lays its answer out. With no Book chosen, Today is the shelf.
//
// Both pages are deliberately full. Today used to end 122px above a pinned
// footer on a 1280x800 screen with the bottom half of the viewport empty, which
// on the first screen of a book reads as a book with nothing in it.

import { state } from './state.js';
import { t, tList, ui } from './i18n.js';
import { h, pct } from './utils.js';
import { href } from './router.js';
import * as books from './books.js';
import { composeToday } from './today.js';
import { action, textAction, textLink, evidenceLine, hairline, titleOf } from './render-shared.js';
import { catalogView } from './render-contents.js';
import { drillRow } from './render-chapter.js';

export async function todayView() {
  const bookId = state.prefs.bookId;
  if (!bookId) return catalogView();
  const book = await books.openBook(bookId);
  const plan = await composeToday(book);

  return [
    h('div', { class: 'rn-open-head' }, [
      h('a', { class: 'rn-open-book', href: href('book', { bookId }) }, [
        h('span', { class: 'rn-book-glyph', 'aria-hidden': 'true' }, book.glyph),
        h('span', {}, t(book.title)),
      ]),
      textLink(ui('books'), 'catalog', {}),
    ]),
    h('div', { class: 'rn-open' }, [
      leftPage(book, plan),
      h('div', { class: 'rn-spine', 'aria-hidden': 'true' }),
      rightPage(book, plan),
    ]),
  ];
}

function leftPage(book, plan) {
  const next = plan.next;
  if (!next) {
    return h('section', { class: 'rn-open-page' }, [
      h('p', { class: 'rn-open-kicker' }, ui('leftOffAt')),
      h('h2', { class: 'rn-open-title' }, ui('allPassed')),
    ]);
  }
  const doc = plan.nextDoc;
  const rung = plan.nextRung;
  const go = rung
    ? action(ui('continueReading'), 'open-rung', { book: book.id, chapter: next.id, rung: rung.id }, 'btn btn--primary')
    : h('a', { class: 'btn btn--primary', href: href('chapter', { bookId: book.id, chapterId: next.id }) }, ui('continueReading'));
  return h('section', { class: 'rn-open-page' }, [
    h('p', { class: 'rn-open-kicker' }, ui('leftOffAt')),
    h('div', { class: 'rn-title-block' }, [
      h('h2', { class: 'rn-open-title' }, doc ? t(doc.title) : next.id),
      next.evidence ? hairline(next.evidence) : null,
    ]),
    rung ? h('p', { class: 'rn-open-rung' }, t(rung.title)) : null,
    openQuote(rung),
    doc ? h('p', { class: 'rn-goal' }, t(doc.goal && doc.goal.statement)) : null,
    // The loader's own words are for whoever is writing the Book, not for the
    // person reading it: the reader is told the chapter did not load, and the
    // detail keeps the file name it names.
    plan.nextError
      ? h('div', {}, [
          h('p', { class: 'rn-warn' }, ui('loadFailed')),
          h('pre', { class: 'rn-detail' }, plan.nextError),
        ])
      : null,
    evidenceLine(next.evidence),
    h('div', { class: 'toolbar' }, go),
  ]);
}

/**
 * The paragraph the bookmark is sitting on. Today's left page is the page you
 * stopped on, so it quotes the words rather than only naming their address, and
 * the CSS clamps it at four lines: this is a reminder, not the chapter.
 *
 * The first page of a rung is usually prose but may be a figure, which carries
 * no body, so this takes the first page that has words rather than pages[0].
 */
function openQuote(rung) {
  for (const page of (rung && rung.pages) || []) {
    const first = tList(page.body)[0];
    if (first) return h('p', { class: 'rn-open-quote' }, first);
  }
  return null;
}

/**
 * Why this drill and not another, in the reader's terms. The skill is an id in
 * the attempt log ("kana.hiragana.read"); the chapter whose goal is measured by
 * that id has a title, and that is the thing a learner can go and read.
 */
function weakestLine(plan, game) {
  const at = pct(game.because.accuracy);
  const owner = (plan.rows || []).find((r) => {
    const ev = r.doc && r.doc.goal && r.doc.goal.evidence;
    return ev && ev.skill === game.because.skill;
  });
  return h('p', { class: 'rn-lead' }, owner
    ? ui('weakestInChapter', { pct: at, chapter: titleOf(owner) })
    : ui('weakestIn', { pct: at }));
}

function rightPage(book, plan) {
  const items = [];

  const decks = plan.reviews.decks;
  items.push(h('li', { class: 'rn-open-item' }, [
    h('p', { class: 'rn-open-label' }, ui('reviews')),
    decks.length
      ? h('ul', { class: 'rn-open-sub' }, decks.map((d) => h('li', {}, [
          textAction(t(d.exercise.title) || d.exercise.id, 'open-exercise', { book: book.id, chapter: d.chapterId, exercise: d.exercise.id }),
          ` · ${d.due} ${ui('due')}`,
        ])))
      : h('p', { class: 'rn-lead' }, ui('nothingDue')),
  ]));

  const game = plan.game;
  items.push(h('li', { class: 'rn-open-item' }, [
    h('p', { class: 'rn-open-label' }, ui('oneDrill')),
    game ? h('p', { class: 'rn-open-item-title' }, t(game.exercise.title) || game.exercise.id) : null,
    game && game.because ? weakestLine(plan, game) : null,
    game
      ? h('div', { class: 'toolbar' }, action(ui('start'), 'open-exercise', { book: book.id, chapter: game.chapterId, exercise: game.exercise.id }))
      : h('p', { class: 'rn-lead' }, ui('noGame')),
  ]));

  const rest = restOfRung(book, plan, game);
  if (rest) items.push(rest);
  const rungs = chapterRungs(book, plan);
  if (rungs) items.push(rungs);

  if (plan.overrides.length) {
    items.push(h('li', { class: 'rn-open-item' }, [
      h('p', { class: 'rn-open-label' }, ui('opened')),
      h('p', { class: 'rn-lead' }, ui('overrideNote')),
      h('ul', { class: 'rn-open-sub' }, plan.overrides.map((row) => h('li', {}, [
        h('a', { href: href('chapter', { bookId: book.id, chapterId: row.id }) }, t((row.doc && row.doc.title) || row.entry.title) || row.id),
        ' · ',
        textAction(ui('relock'), 'override-off', { chapter: row.id }),
      ]))),
    ]));
  }

  return h('section', { class: 'rn-open-page' }, [
    h('h2', { class: 'rn-open-today' }, ui('today')),
    h('ul', { class: 'rn-open-list' }, items),
  ]);
}

/**
 * The rest of the bookmarked rung, drawn as the recto draws it: a tick, the
 * title, and the mark it earned. The day's drill is already named above, so it
 * is not listed twice. These open through the route, not in place, because the
 * chapter they belong to is not the page you are on.
 */
function restOfRung(book, plan, game) {
  const doc = plan.nextDoc;
  const rung = plan.nextRung;
  if (!doc || !rung) return null;
  const rest = (rung.exercises || []).filter(
    (ex) => !(game && game.chapterId === doc.id && game.exercise.id === ex.id),
  );
  if (!rest.length) return null;
  return h('li', { class: 'rn-open-item' }, [
    h('p', { class: 'rn-open-label' }, ui('alsoOnThisRung')),
    h('ul', { class: 'rn-facing-list' }, rest.map((ex) => drillRow(book, doc, ex, 'open-exercise'))),
  ]);
}

/**
 * The chapter you are in, as its pages. The bookmark ribbon hangs into the one
 * you stopped on, the same ribbon the rail uses, so Today and the contents say
 * where you are in the same mark rather than in two.
 */
function chapterRungs(book, plan) {
  const doc = plan.nextDoc;
  const rungs = (doc && doc.rungs) || [];
  if (rungs.length < 2) return null;
  const at = plan.nextRung && plan.nextRung.id;
  return h('li', { class: 'rn-open-item' }, [
    h('p', { class: 'rn-open-label' }, ui('inThisChapter')),
    h('ul', { class: 'rn-open-sub rn-open-sub--rungs' }, rungs.map((rung) => {
      const here = rung.id === at;
      const link = textAction(t(rung.title), 'open-rung', { book: book.id, chapter: doc.id, rung: rung.id }, 'rn-open-rung-link');
      if (here) link.setAttribute('aria-current', 'location');
      return h('li', { class: here ? 'rn-open-rung-row rn-open-rung-row--at' : 'rn-open-rung-row' }, [
        here ? h('span', { class: 'rn-bookmark', 'aria-hidden': 'true' }) : null,
        link,
      ]);
    })),
  ]);
}
