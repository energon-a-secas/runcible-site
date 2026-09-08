// ── Page kinds, for the read type ────────────────────────────
// C3.3 defines four kinds: prose, table, figure, callout. This renders them
// inside an exercise host so the read type has something to show.
//
// Scope, stated plainly so the overlap is not mistaken for a decision: the
// chapter flow's own page renderer is js/render.js and belongs to the shell
// (A1a). This file exists because C2.1 gives the read type a pages[] of the
// same schema and an exercise host is a different surface. If the shell ends up
// exporting a page renderer, this should call it instead of matching it.
//
// figure is NOT rendered here. An svg figure is a data pointer plus a named
// render, and drawing it would mean either putting markup from a data file
// into the page, which C3.3 forbids, or writing a second renderer for a
// notation the shell owns. It shows its caption and names itself instead of
// pretending.
//
// links[] IS rendered here, as of 2026-09-08. It was not, and a page shown
// inside a read exercise silently dropped every citation the same page draws
// in the reading column: the author saw the anchors while writing the chapter
// and the reader met a paragraph that referred to a list that was not there.
// The rule is the shell's (js/render-pages.js linksNode) and it is repeated,
// not reinterpreted, because two renderers disagreeing about a scheme is how
// a "javascript:" href reaches a browser.

import { el, append } from '../dom.js';
import { paragraphs } from '../bilingual.js';
import { chrome } from '../strings.js';

function renderFigure(figure, t) {
  if (!figure) return null;
  const caption = t(figure.caption);
  const kind = figure.kind ? String(figure.kind) : 'unknown';
  const src = figure.src ? String(figure.src) : (figure.builder ? String(figure.builder) : '');
  return el('figure', {
    class: 'rx-figure',
    dataset: { figureKind: kind, figureSrc: src, figureRender: figure.render || '' },
  }, [
    el('p', { class: 'rx-figure-missing', text: chrome(t, 'figureNotDrawn', { kind, src }).trim() }),
    caption ? el('figcaption', { class: 'rx-figure-caption', text: caption }) : null,
  ]);
}

/**
 * A page's `links[]` (C3.3), the one anchor a chapter may draw, on any page
 * kind. The shell renders it in the reading column (js/render-pages.js
 * linksNode); this is the same list inside an exercise host.
 *
 * Three rules travel with it, and all three are the shell's:
 *
 *   https only. A chapter is authored by a skill, so a scheme the renderer
 *   would hand to the browser is settled here rather than trusted. A refused
 *   link is named on the page, not dropped, so a bad href is visible to the
 *   reader who found it and not only to whoever runs the validator
 *   (tools/lib/page-links.mjs refuses the same schemes at build time).
 *
 *   Off-site by definition, so every anchor opens in a new tab and carries
 *   rel="noopener noreferrer". Losing a reader's place mid-drill is worse
 *   here than in the reading column: a mounted exercise is a session.
 *
 *   The label falls back to the href, because a list of bare URLs still
 *   works and a blank anchor does not.
 *
 * No CSS is added for this. The three classes that carry appearance are the
 * site's own (.rn-textlink, .rn-note, .rn-warn), so a citation inside a drill
 * reads exactly like the same citation in the reading column; .rx-links is
 * this host's block and styles nothing today.
 *
 * @param {*} links the page's links field
 * @param {(v: *) => string} t the {en,es} resolver for scalars, api.t
 * @returns {HTMLElement|null} null when there is nothing to draw
 */
function renderLinks(links, t) {
  if (!Array.isArray(links) || links.length === 0) return null;
  const items = [];
  for (const link of links) {
    const href = link && typeof link.href === 'string' ? link.href : '';
    const label = t(link && link.label) || href;
    if (!href.startsWith('https://')) {
      items.push(el('li', {}, [
        el('span', { class: 'rn-warn', text: `link refused, https only: ${href || '(no href)'}` }),
      ]));
      continue;
    }
    const note = t(link && link.note);
    items.push(el('li', {}, [
      el('a', {
        class: 'rn-textlink', href, target: '_blank', rel: 'noopener noreferrer', text: label,
      }),
      note ? el('span', { class: 'rn-note', text: ` ${note}` }) : null,
    ]));
  }
  return el('ul', { class: 'rx-links' }, items);
}

/**
 * Render one C3.3 page into a container.
 * @param {HTMLElement} target
 * @param {object} page
 * @param {(v: *) => string} t the {en,es} resolver for scalars, api.t
 * @param {Array|null} items rows already resolved by the caller, for kind table
 * @param {string} lang api.lang, for list valued fields api.t cannot resolve
 */
export function renderPage(target, page, t, items, lang) {
  const kind = page && page.kind ? String(page.kind) : 'prose';
  const title = t(page && page.title);

  if (title) target.appendChild(el('h4', { class: 'rx-page-title', text: title }));

  // Every kind may carry links, and they close the page whichever kind it is.
  // Built once here so the branches below cannot each grow their own idea of
  // where a citation goes.
  const links = renderLinks(page && page.links, t);

  if (kind === 'callout') {
    const tone = ['note', 'warn', 'win'].includes(page.tone) ? page.tone : 'note';
    const box = el('div', { class: 'rx-callout card', dataset: { tone } });
    for (const p of paragraphs(page.body, lang)) box.appendChild(el('p', { text: p }));
    target.appendChild(box);
    append(target, links);
    return;
  }

  if (kind === 'table') {
    const columns = Array.isArray(page.columns) ? page.columns.map((c) => t(c)) : [];
    const rows = Array.isArray(page.rows) ? page.rows : rowsFromItems(page, items);
    const table = el('table', { class: 'rx-table' });
    if (columns.length) {
      const head = el('tr');
      for (const c of columns) head.appendChild(el('th', { scope: 'col', text: c }));
      table.appendChild(el('thead', {}, [head]));
    }
    const body = el('tbody');
    for (const row of rows) {
      const tr = el('tr');
      for (const cell of row) tr.appendChild(el('td', { text: typeof cell === 'object' ? t(cell) : String(cell) }));
      body.appendChild(tr);
    }
    table.appendChild(body);
    target.appendChild(table);
    append(target, links);
    return;
  }

  if (kind === 'figure') {
    const fig = renderFigure(page.figure, t);
    if (fig) target.appendChild(fig);
    else target.appendChild(el('p', { class: 'rx-figure-missing', text: chrome(t, 'figureEmpty') }));
    append(target, links);
    return;
  }

  // prose, and anything unrecognised, which reads as prose rather than blank
  for (const p of paragraphs(page.body, lang)) {
    target.appendChild(el('p', { class: 'rx-para', text: p }));
  }
  const note = t(page.note);
  if (note) target.appendChild(el('p', { class: 'rx-note', text: note }));
  const fig = renderFigure(page.figure, t);
  if (fig) target.appendChild(fig);
  append(target, links);
}

/**
 * A table page may point at data instead of listing rows (C3.3). It must then
 * say which field fills which column: guessing the order from object keys would
 * make a column silently swap when a data file gains a field.
 */
function rowsFromItems(page, items) {
  if (!Array.isArray(items)) return [];
  const fields = Array.isArray(page.fields) ? page.fields : null;
  return items.map((item) => {
    if (Array.isArray(item)) return item;
    if (!fields) return [];
    return fields.map((f) => (item && item[f] !== undefined ? item[f] : ''));
  });
}

export { renderFigure, renderLinks };
