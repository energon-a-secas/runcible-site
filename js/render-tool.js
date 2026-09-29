// A Book's tools: the full-width page at #/tool/<bookId>/<toolId>, the header
// link to it, and the entries on the contents page and in the rail.
//
// A tool is declared in the manifest (js/book-tools.js has the shape) and drawn
// by a sibling site in a frame, so this file knows no subject and no tool: it
// looks the embed up in EMBEDS, which holds exactly the names TOOL_EMBEDS
// freezes. A tool records nothing, so nothing here touches progress.
//
// The frame is mounted after the paint, not while the view is built: a view
// that loses the race to a newer paint is thrown away by render(), and a frame
// mounted inside it would leave a message listener and a silence timer behind
// for a page nobody can see.

import { state } from './state.js';
import { t, ui } from './i18n.js';
import { h } from './utils.js';
import { href } from './router.js';
import * as books from './books.js';
import { toolsOf, findTool } from './book-tools.js';
import { mountYomuEmbed } from './yomu-host.js';

const EMBEDS = { yomu: mountYomuEmbed };
const HOST_ID = 'rn-tool-host';
let current = null;   // the mounted embed on the tool page

export async function toolView(bookId, toolId) {
  const book = await books.openBook(bookId);
  const tool = findTool(book, toolId);
  if (!tool) {
    throw new books.LoadError(toolId ? `tool "${toolId}" is not in this Book` : 'this Book declares no tools', book.dir + 'book.json');
  }
  return [
    h('header', { class: 'rn-book-head rn-tool-head' }, [
      tool.glyph ? h('span', { class: 'rn-book-glyph', 'aria-hidden': 'true' }, tool.glyph) : null,
      h('div', { class: 'rn-book-titles' }, [
        h('h2', { class: 'rn-chapter-title' }, t(tool.title)),
        tool.description ? h('p', { class: 'rn-goal' }, t(tool.description)) : null,
        h('a', { class: 'rn-textlink', href: href('book', { bookId: book.id }) }, ui('backToBook', { book: t(book.title) })),
      ]),
    ]),
    h('div', { class: 'rn-tool-host', id: HOST_ID, 'data-tool': tool.id }),
  ];
}

/** Tear down the tool page's frame. render() calls this before every paint. */
export function destroyTool() {
  if (!current) return;
  try { current.destroy(); } catch (e) { console.error('[runcible] tool teardown failed', e); }
  current = null;
}

/** After every paint: the header link, and the frame when the route is a tool. */
export function afterToolPaint(route) {
  syncToolLink(route);
  if (!route || route.name !== 'tool') return;
  const host = document.getElementById(HOST_ID);
  const book = state.book;
  const tool = host && host.isConnected ? findTool(book, host.dataset.tool) : null;
  if (!tool) return;
  destroyTool();
  current = EMBEDS[tool.embed]({ host, title: `${t(tool.title)} - Yomu`, cls: 'rn-yomu--page' });
}

/**
 * The header's tool link: shown only when the chosen Book is the open one and
 * declares a tool, pointing at its first tool. The header kit collapses
 * controls into its overflow menu at init, so a control that appears later is
 * handed back to it with NeoHeader.syncOverflow().
 */
export function syncToolLink(route) {
  const link = document.querySelector('[data-rn-tool-link]');
  if (!link) return;
  const book = state.book && state.book.id === state.prefs.bookId ? state.book : null;
  const tool = book ? findTool(book) : null;
  const was = !link.hidden;
  link.hidden = !tool;
  if (tool) link.setAttribute('href', href('tool', { bookId: book.id, toolId: tool.id }));
  if (route && route.name === 'tool') link.setAttribute('aria-current', 'page');
  else link.removeAttribute('aria-current');
  if (was !== !!tool && window.NeoHeader && typeof window.NeoHeader.syncOverflow === 'function') {
    window.NeoHeader.syncOverflow();
  }
}

/**
 * The tools as a list of links. `withNotes` adds each description under its
 * title, which the contents page has room for and the 204px rail does not.
 */
export function toolList(book, { cls = 'rn-tools', withNotes = false } = {}) {
  const tools = toolsOf(book);
  if (!tools.length) return null;
  return h('ul', { class: cls }, tools.map((tool) => h('li', { class: 'rn-tools-item' }, [
    h('a', { class: 'rn-tools-link', href: href('tool', { bookId: book.id, toolId: tool.id }) }, [
      tool.glyph ? h('span', { class: 'rn-tools-glyph', 'aria-hidden': 'true' }, tool.glyph) : null,
      h('span', { class: 'rn-tools-title' }, t(tool.title)),
    ]),
    withNotes && tool.description ? h('p', { class: 'rn-tools-note' }, t(tool.description)) : null,
  ])));
}
