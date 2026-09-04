// Every DOM node this site draws. Nothing here knows what a Book teaches.
//
// Content reaches the page as text nodes and attributes only, never as markup:
// h() builds elements and sets textContent, and there is no innerHTML in this
// file. C3.3 forbids inline HTML in a content field, and a chapter is authored
// by a skill, so the safe path has to be the only path.

import { state } from './state.js';
import { t, tList, ui, beginPage, hadFallback, onFallback, applyChrome } from './i18n.js';
import { h, append, clear, pct } from './utils.js';
import { href } from './router.js';
import * as books from './books.js';
import * as progress from './progress.js';
import { composeToday } from './today.js';
import { deckUrl } from './embed.js';

const VIEW_ID = 'view';
let token = 0;                 // guards against a slow view painting over a new one
const mounted = new Map();     // exerciseId -> { destroy }

function view() { return document.getElementById(VIEW_ID); }

function badge(kind, label) {
  return h('span', { class: `rn-badge rn-badge--${kind}` }, label || ui(kind));
}

function card(children, cls = '') {
  return h('div', { class: `card ${cls}`.trim() }, children);
}

function action(label, act, data = {}, cls = 'btn btn--secondary btn--sm') {
  const attrs = { class: cls, type: 'button', 'data-action': act };
  for (const [k, v] of Object.entries(data)) attrs[`data-${k}`] = v;
  return h('button', attrs, label);
}

function link(label, name, params, cls = 'btn btn--ghost btn--sm') {
  return h('a', { class: cls, href: href(name, params) }, label);
}

/** A skill evidence readout: 34/40 at 91%, target 90%. */
function meter(status) {
  if (!status) return null;
  const width = status.min ? Math.min(100, (status.graded / status.min) * 100) : 0;
  return h('div', { class: 'rn-meter' }, [
    h('div', { class: 'rn-meter-track' }, h('div', { class: 'rn-meter-bar', style: `width:${width}%` })),
    h('p', { class: 'rn-meter-label' },
      `${status.graded}/${status.min} ${ui('attempts')} · ${pct(status.accuracy)} ${ui('correct')} · ${ui('goal')} ${pct(status.target)}`),
  ]);
}

/** The one line the honesty rule owes a Spanish reader. */
function fallbackNote() {
  if (state.prefs.lang === 'en' || !hadFallback()) return null;
  return h('p', { class: 'rn-note rn-note--fallback' }, ui('untranslated'));
}

// An exercise mounts after render() emitted its line, so a late fallback adds it.
onFallback(() => {
  const root = view();
  if (root && root.getAttribute('aria-busy') !== 'true' && !root.querySelector('.rn-note--fallback')) root.appendChild(fallbackNote());
});

/** C11.3: the acknowledgement block, at the foot of the main content region. */
function attribution(book, chapter) {
  const rows = books.attributionsFor(book, chapter);
  if (!rows.length) return null;
  return h('section', { class: 'neo-attrib', 'aria-label': 'Attribution' },
    rows.map((row) => h('p', {}, [
      row.text,
      ...row.links.map((url) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, url)),
    ])));
}

function errorCard(message, detail) {
  return card([
    h('h2', { class: 'section__title' }, ui('loadFailed')),
    h('p', { class: 'section__lead' }, message),
    detail ? h('pre', { class: 'rn-detail' }, detail) : null,
    link(ui('books'), 'catalog', {}),
  ], 'rn-error');
}

// Views

async function catalogView() {
  const catalog = await books.loadCatalog();
  const cards = (catalog.books || []).map((b) => {
    const planned = b.state === 'planned';
    const body = [
      h('span', { class: 'rn-glyph', 'aria-hidden': 'true' }, b.glyph),
      h('h3', {}, t(b.title)),
      h('span', { class: `rn-badge rn-badge--${b.state}` }, ({ ready: 'Ready', soon: 'Soon', planned: 'Planned', draft: 'Draft' })[b.state] || b.state),
    ];
    return planned
      ? h('div', { class: 'card rn-book rn-book--planned' }, body)
      : h('a', { class: 'card card--interactive rn-book', href: href('book', { bookId: b.id }) }, body);
  });
  return [
    h('h2', { class: 'section__title' }, ui('books')),
    h('div', { class: 'rn-grid' }, cards),
  ];
}

function trackPicker(book) {
  const tracks = book.tracks || [];
  if (tracks.length < 2) return null;
  const current = progress.currentTrack(book);
  return h('div', { class: 'rn-tracks' }, [
    h('h3', { class: 'rn-sub' }, ui('track')),
    h('div', { class: 'toolbar' }, tracks.map((tr) => action(
      t(tr.label),
      'set-track',
      { track: tr.id },
      `btn btn--sm ${tr.id === current ? 'btn--primary' : 'btn--ghost'}`,
    ))),
    h('p', { class: 'section__lead' }, t((tracks.find((tr) => tr.id === current) || {}).description)),
  ]);
}

function ladderRow(book, row) {
  const doc = row.doc;
  const title = doc ? t(doc.title) : t(row.entry.title) || row.id;
  const statement = doc ? t(doc.goal && doc.goal.statement) : t(row.entry.note);
  const parts = [
    h('div', { class: 'rn-row-head' }, [
      h('h3', {}, title),
      badge(row.state === 'planned' ? 'planned' : row.state),
      row.override ? badge('opened') : null,
    ]),
    statement ? h('p', { class: 'section__lead' }, statement) : null,
    row.error ? h('p', { class: 'rn-warn' }, row.error) : null,
    row.evidence ? meter(row.evidence) : null,
  ];
  if (row.state === 'available' || row.state === 'passed') {
    parts.push(h('div', { class: 'toolbar' }, link(ui('open'), 'chapter', { bookId: book.id, chapterId: row.id }, 'btn btn--secondary btn--sm')));
  } else if (row.state === 'locked') {
    // C3.4: every locked chapter carries a visible manual override. A gate a
    // self-taught adult cannot open is a wall.
    parts.push(h('div', { class: 'toolbar' }, action(ui('openAnyway'), 'override-on', { chapter: row.id })));
  }
  return h('li', { class: `rn-chapter rn-chapter--${row.state}` }, parts);
}

async function bookView(bookId) {
  const book = await books.openBook(bookId);
  const docs = await books.loadLadder(book);
  const rows = progress.ladder(book, docs);
  return [
    h('header', { class: 'rn-book-head' }, [
      h('span', { class: 'rn-glyph rn-glyph--lg', 'aria-hidden': 'true' }, book.glyph),
      h('div', {}, [
        h('h2', { class: 'section__title' }, t(book.title)),
        h('p', { class: 'section__lead' }, t(book.tagline)),
        book.goal ? h('p', { class: 'rn-goal' }, `${ui('goal')}: ${t(book.goal)}`) : null,
      ]),
    ]),
    trackPicker(book),
    h('h3', { class: 'rn-sub' }, ui('chapters')),
    h('ul', { class: 'rn-ladder' }, rows.map((row) => ladderRow(book, row))),
  ];
}

function pageNode(book, page) {
  const parts = [];
  if (page.title) parts.push(h('h4', {}, t(page.title)));
  for (const para of tList(page.body)) parts.push(h('p', {}, para));
  if (page.kind === 'table') parts.push(tableNode(book, page));
  if (page.figure) parts.push(figureNode(book, page.figure));
  for (const para of tList(page.note)) parts.push(h('p', { class: 'rn-note' }, para));
  const cls = page.kind === 'callout' ? `rn-page rn-callout rn-callout--${page.tone || 'note'}` : 'rn-page';
  return h('div', { class: cls }, parts);
}

function tableNode(book, page) {
  let rows = Array.isArray(page.rows) ? page.rows : [];
  if (!rows.length && page.items) {
    try {
      const { src, frag } = books.splitPointer(page.items);
      const doc = books.peekData(src);
      const value = doc ? books.resolveFragment(doc, frag, src) : null;
      rows = Array.isArray(value) ? value : Object.values(value || {});
    } catch (e) {
      return h('p', { class: 'rn-warn' }, e.message);
    }
  }
  const cols = page.columns || [];
  const cell = (row, i) => {
    if (Array.isArray(row)) return row[i];
    const key = typeof cols[i] === 'string' ? cols[i] : (cols[i] && (cols[i].key || cols[i].en));
    return row && typeof row === 'object' ? row[key] : row;
  };
  return h('table', { class: 'rn-table' }, [
    h('thead', {}, h('tr', {}, cols.map((c) => h('th', {}, t(c))))),
    h('tbody', {}, rows.map((row) => h('tr', {}, cols.map((c, i) => h('td', {}, String(cell(row, i) ?? '')))))),
  ]);
}

/**
 * A figure. The shell draws geometry, never markup: an svg figure resolves to
 * path strings and each one becomes a <path d="...">, so a data file cannot
 * inject an element. Anything else says what it could not draw, on the page.
 *
 * The accepted shapes are an array of path strings, or an object carrying them
 * under `paths` or `s`, with a viewBox on the record or on the file. C3.3 names
 * a `render` id but freezes no data shape for it and C2.2 gives a Book no way
 * to register a renderer, so the shell has to state what it can draw.
 */
function figureNode(book, figure) {
  const parts = [];
  if (figure.kind === 'svg') {
    try {
      const { src, frag } = books.splitPointer(figure.src);
      const doc = books.peekData(src);
      const value = doc ? books.resolveFragment(doc, frag, src) : null;
      const paths = Array.isArray(value) ? value
        : (value && (Array.isArray(value.paths) ? value.paths : Array.isArray(value.s) ? value.s : null));
      if (!paths) throw new Error(`figure "${figure.render}" needs path strings, ${src}#${frag} gave something else`);
      const box = (value && value.viewBox) || (doc && doc.viewBox) || figure.viewBox || '0 0 109 109';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', box);
      svg.setAttribute('class', 'rn-svg');
      svg.setAttribute('aria-hidden', 'true');
      for (const d of paths) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', String(d));
        svg.appendChild(p);
      }
      parts.push(svg);
    } catch (e) {
      parts.push(h('p', { class: 'rn-warn' }, e.message));
    }
  } else {
    parts.push(h('p', { class: 'rn-warn' }, `no renderer for a ${figure.kind} figure`));
  }
  if (figure.caption) parts.push(h('figcaption', {}, t(figure.caption)));
  return h('figure', { class: 'rn-figure' }, parts);
}

function exerciseNode(book, chapter, ex) {
  const done = progress.exerciseState(book.id, chapter.id, ex.id);
  const host = h('div', { class: 'rn-ex-host', id: `ex-${ex.id}` });
  const head = h('div', { class: 'rn-row-head' }, [
    h('h4', {}, t(ex.title) || ex.id),
    h('span', { class: 'rn-type' }, ex.type),
    done ? badge('passed', done.best === null ? '✓' : pct(done.best)) : null,
  ]);
  const bar = h('div', { class: 'toolbar' }, [
    action(ui('start'), 'start-exercise', { chapter: chapter.id, exercise: ex.id }, 'btn btn--primary btn--sm'),
    // C6.5: a deck always carries the link to the unpartitioned top level,
    // because that is the one path that always works.
    ex.type === 'deck' ? h('a', {
      class: 'btn btn--ghost btn--sm',
      href: deckUrl(ex, { embed: false }),
      target: '_blank',
      rel: 'noopener noreferrer',
    }, ui('openInRappel')) : null,
  ]);
  return h('div', { class: 'rn-ex' }, [head, bar, host]);
}

function rungNode(book, chapter, rung) {
  return h('section', { class: 'rn-rung' }, [
    h('h3', { class: 'rn-sub' }, t(rung.title)),
    // C3.1 writes unlocks as the completion of a sentence ("every other row,
    // because..."), so the label is the shell's and the clause is the Book's.
    rung.unlocks ? h('p', { class: 'section__lead' }, `${ui('unlocks')}: ${t(rung.unlocks)}`) : null,
    ...(rung.pages || []).map((p) => pageNode(book, p)),
    ...(rung.exercises || []).map((ex) => exerciseNode(book, chapter, ex)),
  ]);
}

async function chapterView(bookId, chapterId) {
  const book = await books.openBook(bookId);
  const entry = (book.chapters || []).find((c) => c.id === chapterId);
  if (!entry) throw new books.LoadError(`chapter "${chapterId}" is not in this Book`, book.dir + 'book.json');
  const docs = await books.loadLadder(book);
  const row = progress.ladder(book, docs).find((r) => r.id === chapterId);

  if (row.state === 'planned') {
    return [link(ui('back'), 'book', { bookId }), card([
      h('h2', { class: 'section__title' }, t(entry.title) || chapterId),
      badge('planned'),
      h('p', { class: 'section__lead' }, t(entry.note)),
    ])];
  }
  if (row.state === 'locked') {
    const need = progress.requiresFor(book, entry);
    return [link(ui('back'), 'book', { bookId }), card([
      // The ladder loaded every chapter document to work out this row's state,
      // so the title is already here. Only a planned entry carries one on the
      // manifest (C1.2), which is why the id alone was showing.
      h('h2', { class: 'section__title' }, (row.doc ? t(row.doc.title) : t(entry.title)) || chapterId),
      badge('locked'),
      h('p', { class: 'section__lead' }, `${ui('evidence')}: ${need.join(', ') || '-'}`),
      row.evidence ? meter(row.evidence) : null,
      h('div', { class: 'toolbar' }, action(ui('openAnyway'), 'override-on', { chapter: chapterId }, 'btn btn--secondary btn--sm')),
    ])];
  }

  const chapter = await books.loadChapter(book, chapterId);
  state.chapter = chapter;
  return [
    h('div', { class: 'toolbar' }, [
      link(ui('back'), 'book', { bookId }),
      row.override ? action(ui('relock'), 'override-off', { chapter: chapterId }, 'btn btn--ghost btn--sm') : null,
    ]),
    h('header', { class: 'rn-chapter-head' }, [
      h('h2', { class: 'section__title' }, t(chapter.title)),
      badge(row.state),
      h('p', { class: 'rn-goal' }, `${ui('goal')}: ${t(chapter.goal && chapter.goal.statement)}`),
      meter(row.evidence),
    ]),
    ...(chapter.rungs || []).map((rung) => rungNode(book, chapter, rung)),
    attribution(book, chapter),
  ];
}

async function todayView() {
  const bookId = state.prefs.bookId;
  if (!bookId) return catalogView();
  const book = await books.openBook(bookId);
  const plan = await composeToday(book);

  const next = plan.next
    ? card([
        h('h3', { class: 'rn-sub' }, ui('nextLesson')),
        h('h2', {}, plan.nextDoc ? t(plan.nextDoc.title) : plan.next.id),
        plan.nextDoc ? h('p', { class: 'section__lead' }, t(plan.nextDoc.goal && plan.nextDoc.goal.statement)) : null,
        plan.nextError ? h('p', { class: 'rn-warn' }, plan.nextError) : null,
        plan.nextRung ? h('p', { class: 'rn-note' }, t(plan.nextRung.title)) : null,
        meter(plan.next.evidence),
        h('div', { class: 'toolbar' }, link(ui('open'), 'chapter', { bookId, chapterId: plan.next.id }, 'btn btn--primary btn--sm')),
      ])
    : card([h('h3', { class: 'rn-sub' }, ui('nextLesson')), h('p', { class: 'section__lead' }, ui('allPassed'))]);

  const decks = plan.reviews.decks.map((d) => h('li', {}, [
    h('a', { href: href('chapter', { bookId, chapterId: d.chapterId }) }, t(d.exercise.title) || d.exercise.id),
    ` ${d.due} ${ui('due')}`,
  ]));
  const skills = plan.reviews.skills.map((s) => h('li', {}, `${s.skill} ${pct(s.accuracy)} (${s.graded})`));
  const reviews = card([
    h('h3', { class: 'rn-sub' }, ui('reviews')),
    decks.length ? h('ul', { class: 'rn-list' }, decks) : null,
    skills.length ? h('h4', { class: 'rn-sub' }, ui('weak')) : null,
    skills.length ? h('ul', { class: 'rn-list' }, skills) : null,
    !decks.length && !skills.length ? h('p', { class: 'section__lead' }, ui('nothingDue')) : null,
  ]);

  const game = card([
    h('h3', { class: 'rn-sub' }, ui('game')),
    plan.game
      ? h('div', {}, [
          h('h2', {}, t(plan.game.exercise.title) || plan.game.exercise.id),
          plan.game.because ? h('p', { class: 'section__lead' }, `${plan.game.because.skill} ${pct(plan.game.because.accuracy)}`) : null,
          h('div', { class: 'toolbar' }, link(ui('start'), 'chapter', { bookId, chapterId: plan.game.chapterId }, 'btn btn--secondary btn--sm')),
        ])
      : h('p', { class: 'section__lead' }, ui('noGame')),
  ]);

  const overridden = plan.overrides.length
    ? card([
        h('h3', { class: 'rn-sub' }, ui('opened')),
        h('p', { class: 'section__lead' }, ui('overrideNote')),
        h('ul', { class: 'rn-list' }, plan.overrides.map((row) => h('li', {}, [
          h('a', { href: href('chapter', { bookId, chapterId: row.id }) }, t((row.doc && row.doc.title) || row.title || row.id)),
          ' ',
          action(ui('relock'), 'override-off', { chapter: row.id }, 'btn btn--ghost btn--sm'),
        ]))),
      ])
    : null;

  return [
    h('div', { class: 'rn-row-head' }, [
      h('h2', { class: 'section__title' }, `${book.glyph} ${t(book.title)}`),
      link(ui('books'), 'catalog', {}),
    ]),
    next,
    reviews,
    game,
    overridden,
  ];
}

async function settingsView() {
  const rows = [
    h('h2', { class: 'section__title' }, ui('settings')),
    card([
      h('h3', { class: 'rn-sub' }, ui('language')),
      h('div', { class: 'toolbar' }, ['en', 'es'].map((code) => action(
        code === 'en' ? 'English' : 'Español',
        'set-lang',
        { lang: code },
        `btn btn--sm ${state.prefs.lang === code ? 'btn--primary' : 'btn--ghost'}`,
      ))),
    ]),
  ];
  if (state.book) {
    rows.push(card([trackPicker(state.book) || h('p', { class: 'section__lead' }, ui('oneTrack'))]));
    rows.push(card([
      h('h3', { class: 'rn-sub' }, ui('reset')),
      h('div', { class: 'toolbar' }, action(ui('reset'), 'reset-book', { book: state.book.id }, 'btn btn--danger btn--sm')),
    ]));
  }
  const ids = books.registeredIds();
  rows.push(card([
    h('h3', { class: 'rn-sub' }, ui('bookModules')),
    h('p', { class: 'section__lead' }, `exercises: ${ids.exercises.join(', ') || 'none'} · transforms: ${ids.transforms.join(', ') || 'none'}`),
  ]));
  return rows;
}

// The paint loop

const VIEWS = {
  today: () => todayView(),
  catalog: () => catalogView(),
  book: (p) => bookView(p.bookId),
  chapter: (p) => chapterView(p.bookId, p.chapterId),
  settings: () => settingsView(),
};

/** Rebuild the view for the current route. */
export async function render() {
  const mine = ++token;
  const root = view();
  if (!root) return;
  destroyMounted();
  beginPage();
  applyChrome();
  root.setAttribute('aria-busy', 'true');

  let nodes;
  try {
    const route = state.route || { name: 'today', params: {} };
    nodes = await (VIEWS[route.name] || VIEWS.today)(route.params);
  } catch (e) {
    console.error('[runcible]', e);
    nodes = [errorCard(e.message, e.file || null)];
  }
  if (mine !== token) return;   // a newer render already started

  clear(root);
  if (!state.storage) root.appendChild(h('p', { class: 'rn-warn' }, ui('storageOff')));
  append(root, nodes);
  const note = fallbackNote();
  if (note) root.appendChild(note);
  root.removeAttribute('aria-busy');
}

function destroyMounted() {
  for (const handle of mounted.values()) {
    try { handle.destroy(); } catch (e) { console.error('[runcible] exercise destroy failed', e); }
  }
  mounted.clear();
}

/**
 * Mount one exercise into its host. Every type goes through the exercise
 * engine, including deck: that type hands the host to js/embed.js, which is the
 * one implementation of the C6 embed contract.
 */
export async function startExercise(chapterId, exerciseId) {
  const book = state.book;
  const chapter = await books.loadChapter(book, chapterId);
  let spec = null;
  let rungId = null;
  for (const rung of chapter.rungs || []) {
    for (const ex of rung.exercises || []) if (ex.id === exerciseId) { spec = ex; rungId = rung.id; }
  }
  if (!spec) throw new books.LoadError(`exercise "${exerciseId}" is not in this chapter`, chapterId);
  const host = document.getElementById(`ex-${exerciseId}`);
  if (!host) return;
  const old = mounted.get(exerciseId);
  if (old) { old.destroy(); mounted.delete(exerciseId); }

  const ctx = {
    book,
    chapter,
    exercise: spec,
    onDone: (result) => {
      progress.markExercise(book.id, chapterId, exerciseId, result);
      // Completion, recorded per rung. It is never what passes a chapter (C3.4);
      // it is what the Today view reads to pick up where the learner stopped.
      if (rungId) progress.markRung(book.id, chapterId, rungId);
      const handle = mounted.get(exerciseId);
      if (handle) { handle.destroy(); mounted.delete(exerciseId); }
      render();
    },
  };
  const api = books.makeExerciseApi(ctx);
  // The content language is declared once, in the manifest. Filling it in here
  // keeps a chapter from repeating it on every listen and speak exercise, and
  // an exercise that states its own lang still wins.
  const resolved = spec.lang ? spec : { ...spec, lang: (book.lang && book.lang.content) || undefined };
  const handle = books.engine().mount(host, resolved, api, { bookId: book.id, chapterId, rungId });
  mounted.set(exerciseId, handle || { destroy() {} });
  host.scrollIntoView({ behavior: state.prefs.reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
}
