// The small builders every view shares. Nothing here knows what a Book teaches.
//
// Content reaches the page as text nodes only: h() sets textContent, and no
// file in the shell writes innerHTML (C3.3). A chapter is authored by a skill
// and by hand, so the safe path has to be the only path.

import { t, ui } from './i18n.js';
import { h, pct } from './utils.js';
import { href } from './router.js';
import * as books from './books.js';

/** A button that dispatches a data-action; js/events.js owns every handler. */
export function action(label, act, data = {}, cls = 'btn btn--secondary btn--sm') {
  const attrs = { class: cls, type: 'button', 'data-action': act };
  for (const [k, v] of Object.entries(data)) attrs[`data-${k}`] = v;
  return h('button', attrs, label);
}

/** A route link dressed as a button. */
export function link(label, name, params, cls = 'btn btn--ghost btn--sm') {
  return h('a', { class: cls, href: href(name, params) }, label);
}

/** A route link that reads as text, which is what a book uses for a small link. */
export function textLink(label, name, params, data = {}) {
  const attrs = { class: 'rn-textlink', href: href(name, params) };
  for (const [k, v] of Object.entries(data)) attrs[`data-${k}`] = v;
  return h('a', attrs, label);
}

/** A data-action control that reads as text. */
export function textAction(label, act, data = {}, cls = 'rn-textlink') {
  return action(label, act, data, cls);
}

/**
 * Chapter state as a glyph, plus the spelled state for assistive tech. The
 * glyph carries the colour; the sr-only text carries the meaning, because a
 * red dot is not a message.
 */
const GLYPH = { passed: '●', available: '○', locked: '◌', planned: '…' };
export function stateGlyph(st) {
  const key = GLYPH[st] ? st : 'locked';
  return h('span', { class: 'rn-glyph-state', 'data-state': key }, [
    h('span', { 'aria-hidden': 'true' }, GLYPH[key]),
    h('span', { class: 'sr-only' }, ui('stateGlyph', { state: ui(key) })),
  ]);
}

/**
 * The evidence readout as one sentence: what passes, then how far along.
 * "Passes at 80% over 12 answers. So far: 9 of 12 right." No percentage pair,
 * no bar: a book states its terms and reports, it does not dashboard.
 */
export function evidenceSentence(status) {
  if (!status || !status.min) return '';
  const passes = ui('passesAt', { pct: pct(status.target), n: status.min });
  const far = status.graded
    ? ui('soFar', { right: status.correct, graded: status.graded })
    : ui('noneYet');
  return `${passes} ${far}`;
}

export function evidenceLine(status) {
  const text = evidenceSentence(status);
  return text ? h('p', { class: 'rn-evidence' }, text) : null;
}

/** The 2px hairline under a chapter title, filled as a proportion of the goal's minimum. */
export function hairline(status) {
  const fill = status && status.min ? Math.min(100, Math.round((status.graded / status.min) * 100)) : 0;
  return h('div', { class: 'rn-hairline', 'aria-hidden': 'true', style: `--fill:${fill}%` }, h('i'));
}

/** A ladder row's title: the chapter file when loaded, else the manifest entry, else the id. */
export function titleOf(row) {
  const fromDoc = row.doc ? t(row.doc.title) : '';
  return fromDoc || t(row.entry && row.entry.title) || row.id;
}

/** Where a chapter sits in the Book, 1-based, in manifest order. */
export function chapterPosition(book, chapterId) {
  const ids = (book.chapters || []).map((c) => c.id);
  return { at: ids.indexOf(chapterId) + 1, total: ids.length };
}

export function errorBlock(message, detail) {
  return h('section', { class: 'rn-error' }, [
    h('h2', { class: 'rn-title' }, ui('loadFailed')),
    h('p', { class: 'rn-lead' }, message),
    detail ? h('pre', { class: 'rn-detail' }, detail) : null,
    link(ui('books'), 'catalog', {}),
  ]);
}

/** C11.3: the acknowledgement block, at the foot of the main content region. */
export function attribution(book, chapter) {
  const rows = books.attributionsFor(book, chapter);
  if (!rows.length) return null;
  return h('section', { class: 'neo-attrib', 'aria-label': 'Attribution' },
    rows.map((row) => h('p', {}, [
      row.text,
      ...row.links.map((url) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, url)),
    ])));
}
