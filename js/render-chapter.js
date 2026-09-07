// The chapter as a spread: the rail, the reading column, and the facing page
// that holds a running exercise. A locked or planned chapter keeps the rail so
// the reader still sees where they are in the book.

import { state } from './state.js';
import { t, ui } from './i18n.js';
import { h, pct } from './utils.js';
import * as books from './books.js';
import * as progress from './progress.js';
import { firstUnfinishedRung } from './today.js';
import { deckUrl } from './embed.js';
import { action, textAction, stateGlyph, evidenceLine, hairline, titleOf, attribution } from './render-shared.js';
import { pageNode } from './render-pages.js';
import { railNode } from './render-rail.js';

/** Every drill in a rung, in the order the chapter authored them. */
function drillsIn(rung) { return (rung && rung.exercises) || []; }

/** What the marker says about an exercise, so the recto says the same thing. */
function earnedOf(book, chapter, ex) {
  const done = progress.exerciseState(book.id, chapter.id, ex.id);
  if (!done) return { label: '', passed: false };
  const bar = ex.pass && Number.isFinite(ex.pass.accuracy) ? ex.pass.accuracy : null;
  return {
    label: done.best === null ? ui('doneMark') : ui('earned', { pct: pct(done.best) }),
    passed: bar === null || (done.best ?? 0) >= bar,
  };
}

export async function chapterView(bookId, chapterId) {
  const book = await books.openBook(bookId);
  const entry = (book.chapters || []).find((c) => c.id === chapterId);
  if (!entry) throw new books.LoadError(`chapter "${chapterId}" is not in this Book`, book.dir + 'book.json');
  const docs = await books.loadLadder(book);
  const rows = progress.ladder(book, docs);
  const row = rows.find((r) => r.id === chapterId);

  let chapter = null;
  let current = null;
  let prose;
  if (row.state === 'planned') {
    prose = plannedProse(row, entry);
  } else if (row.state === 'locked') {
    prose = lockedProse(book, rows, row, entry);
  } else {
    chapter = await books.loadChapter(book, chapterId);
    state.chapter = chapter;
    current = firstUnfinishedRung(book.id, chapter);
    prose = readingProse(book, chapter, row);
  }
  const rungs = chapter ? (chapter.rungs || []) : [];
  // The recto is only allocated when there is something to answer on it. A
  // planned chapter, a locked one and the study plan have no drills at all, and
  // a quarter of the width behind a hairline showing nothing is the emptiness
  // this spread was meant to fill.
  const facing = chapter ? facingNode(book, chapter, current, row) : null;
  return [
    railNode({ book, rows, chapterId, rungs, current }),
    h('div', { class: 'rn-spread', 'data-recto': facing ? 'page' : 'none' }, [
      h('article', { class: 'rn-prose', id: 'prose' }, prose),
      // The fold. Both sides of the spread are allocated from 980px whether or
      // not a drill is running, so pressing Start never moves the prose, and
      // the recto reads as the page you answer on rather than as dead space.
      facing ? h('div', { class: 'rn-spine', 'aria-hidden': 'true' }) : null,
      facing,
    ]),
  ];
}

/**
 * The facing page: one element with two states, `idle` and `running`.
 *
 * Running, it is the exercise panel, labelled with the exercise title
 * (js/render-mount.js). Idle, it is the recto of the spread: the rung the
 * bookmark is on, its drills as a short index, and what the chapter is measured
 * by. It used to be an empty column behind a hairline whenever no drill was
 * open, which from 980px was a quarter of the page saying nothing.
 *
 * Below 980px the CSS hides the idle state: there is one column there and the
 * drills are already in the prose, three lines under the reader's thumb.
 */
function facingNode(book, chapter, current, row) {
  const rung = current || (chapter.rungs || []).find((r) => drillsIn(r).length) || null;
  const drills = drillsIn(rung);
  const evidence = evidenceLine(row && row.evidence);
  if (!drills.length && !evidence) return null;

  const idle = h('div', { class: 'rn-facing-idle' }, [
    h('p', { class: 'rn-open-kicker', id: 'facing-kicker' }, ui('nextUp')),
    rung ? h('p', { class: 'rn-facing-rung' }, t(rung.title)) : null,
    drills.length
      ? h('ul', { class: 'rn-facing-list' }, drills.map((ex) => drillRow(book, chapter, ex)))
      : null,
    evidence,
  ]);

  return h('aside', {
    class: 'rn-facing',
    id: 'facing',
    role: 'region',
    'data-state': 'idle',
    'data-idle-label': ui('nextUp'),
    'aria-label': ui('nextUp'),
  }, [
    h('div', { class: 'rn-facing-bar' }, action(ui('closeExercise'), 'close-exercise', {}, 'btn btn--ghost btn--sm')),
    h('div', { class: 'rn-facing-host' }),
    idle,
  ]);
}

/**
 * One drill as a line: press it and it opens. On the recto that is
 * `start-exercise`, which mounts it beside the prose you are already reading.
 * Today draws the same row for the bookmarked rung, and there the drill is in a
 * chapter that is not on screen, so it takes `open-exercise`: the route change
 * first, the mount on the paint that follows (js/events.js).
 */
export function drillRow(book, chapter, ex, act = 'start-exercise') {
  const st = earnedOf(book, chapter, ex);
  const data = act === 'open-exercise'
    ? { book: book.id, chapter: chapter.id, exercise: ex.id }
    : { chapter: chapter.id, exercise: ex.id };
  const btn = action(t(ex.title) || ex.id, act, data, 'rn-facing-drill');
  return h('li', { class: st.passed ? 'rn-facing-item rn-facing-item--passed' : 'rn-facing-item' }, [
    h('span', { class: 'rn-facing-tick', 'aria-hidden': 'true' }, st.passed ? '\u2713' : '\u00b7'),
    btn,
    st.label ? h('span', { class: 'rn-facing-earned' }, st.label) : null,
  ]);
}

function titleBlock(title, status) {
  return h('div', { class: 'rn-title-block' }, [
    h('h2', { class: 'rn-chapter-title' }, title),
    status ? hairline(status) : null,
  ]);
}

function readingProse(book, chapter, row) {
  return [
    h('header', { class: 'rn-chapter-head' }, [
      titleBlock(t(chapter.title), row.evidence),
      h('p', { class: 'rn-goal' }, t(chapter.goal && chapter.goal.statement)),
      evidenceLine(row.evidence),
      row.override
        ? h('p', { class: 'rn-state' }, [ui('opened'), ' ', textAction(ui('relock'), 'override-off', { chapter: chapter.id })])
        : null,
    ]),
    ...(chapter.rungs || []).map((rung) => rungNode(book, chapter, rung)),
    attribution(book, chapter),
  ];
}

function lockedProse(book, rows, row, entry) {
  const need = progress.requiresFor(book, entry)
    .map((id) => { const r = rows.find((x) => x.id === id); return r ? titleOf(r) : id; });
  const doc = row.doc;
  return [
    h('header', { class: 'rn-chapter-head' }, [
      titleBlock(titleOf(row), row.evidence),
      doc ? h('p', { class: 'rn-goal' }, t(doc.goal && doc.goal.statement)) : null,
      h('p', { class: 'rn-state' }, [
        stateGlyph('locked'), ' ', `${ui('locked')}. `,
        need.length ? ui('needsFirst', { chapters: need.join(', ') }) : '',
      ]),
      evidenceLine(row.evidence),
      row.error ? h('p', { class: 'rn-warn' }, row.error) : null,
      // C3.4: a gate a self-taught adult cannot open is a wall.
      h('div', { class: 'toolbar' }, action(ui('openAnyway'), 'override-on', { chapter: row.id }, 'btn btn--secondary btn--sm')),
    ]),
  ];
}

function plannedProse(row, entry) {
  return [
    h('header', { class: 'rn-chapter-head' }, [
      titleBlock(titleOf(row), null),
      h('p', { class: 'rn-state' }, [stateGlyph('planned'), ' ', ui('planned')]),
      entry.note ? h('p', { class: 'rn-goal' }, t(entry.note)) : null,
    ]),
  ];
}

function rungNode(book, chapter, rung) {
  return h('section', { class: 'rn-rung', id: `rung-${rung.id}` }, [
    h('h3', { class: 'rn-rung-title' }, t(rung.title)),
    // C3.1 writes unlocks as the completion of a sentence ("every other row,
    // because..."), so the label is the shell's and the clause is the Book's.
    rung.unlocks ? h('p', { class: 'rn-unlocks' }, `${ui('unlocks')}: ${t(rung.unlocks)}`) : null,
    ...(rung.pages || []).map((p) => pageNode(book, p)),
    ...(rung.exercises || []).map((ex) => markerNode(book, chapter, ex)),
  ]);
}

/**
 * The exercise marker: where the chapter authored the exercise, the prose
 * pauses on a hairline, says "Try it", names the exercise once, and offers
 * Start. The engine draws the title again inside its own panel, which is the
 * only other place it appears. A finished exercise shows "Done · 88%" here
 * and never in the rail; a passed one also gets a pencil tick in the margin.
 */
function markerNode(book, chapter, ex) {
  const done = progress.exerciseState(book.id, chapter.id, ex.id);
  const earned = done ? (done.best === null ? ui('doneMark') : ui('earned', { pct: pct(done.best) })) : '';
  const bar = ex.pass && Number.isFinite(ex.pass.accuracy) ? ex.pass.accuracy : null;
  const passed = !!done && (bar === null || (done.best ?? 0) >= bar);
  const start = action(ui('start'), 'start-exercise', { chapter: chapter.id, exercise: ex.id }, 'btn btn--primary btn--sm');
  // "Start" is one word repeated down a chapter. The title beside it is what
  // tells a screen reader which drill this one starts.
  start.setAttribute('aria-describedby', `marker-title-${ex.id}`);
  return h('div', { class: passed ? 'rn-marker rn-marker--passed' : 'rn-marker', id: `marker-${ex.id}` }, [
    h('div', { class: 'rn-marker-row' }, [
      h('span', { class: 'rn-kicker' }, ui('tryIt')),
      h('span', { class: 'rn-marker-state', 'data-earned': earned }, earned),
    ]),
    h('p', { class: 'rn-marker-title', id: `marker-title-${ex.id}` }, t(ex.title) || ex.id),
    h('div', { class: 'toolbar' }, [
      start,
      // C6.5: a deck always carries the link to the unpartitioned top level,
      // because that is the one path that always works.
      ex.type === 'deck' ? h('a', {
        class: 'rn-textlink',
        href: deckUrl(ex, { embed: false }),
        target: '_blank',
        rel: 'noopener noreferrer',
      }, ui('openInRappel')) : null,
    ]),
    h('div', { class: 'rn-ex-host', id: `ex-${ex.id}` }),
  ]);
}
