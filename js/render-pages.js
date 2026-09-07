// A page of prose, a table, a figure. The reading column is made of these.
//
// A page carries an optional id (DESIGN-BOOK.md, feedback line 3) so a rule
// the learner just failed can be scrolled to and washed; the element id is
// page-<id>. Tables run to the column edge inside a scrolling wrapper; text
// keeps to the measure (css: .rn-prose).

import { t, tList } from './i18n.js';
import { h } from './utils.js';
import * as books from './books.js';

export function pageNode(book, page) {
  const parts = [];
  if (page.title) parts.push(h('h4', {}, t(page.title)));
  for (const para of tList(page.body)) parts.push(h('p', {}, para));
  if (page.kind === 'table') parts.push(h('div', { class: 'rn-scroll' }, tableNode(book, page)));
  if (page.figure) parts.push(figureNode(book, page.figure));
  for (const para of tList(page.note)) parts.push(h('p', { class: 'rn-note' }, para));
  const cls = page.kind === 'callout' ? `rn-page rn-callout rn-callout--${page.tone || 'note'}` : 'rn-page';
  return h('div', { class: cls, id: page.id ? `page-${page.id}` : null }, parts);
}

export function tableNode(book, page) {
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
export function figureNode(book, figure) {
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
