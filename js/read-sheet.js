// Tap to read: the runs of a Book's content language inside its pages, and the
// side sheet a tapped run opens.
//
// A Book that declares lang.runs gets every matching stretch of a paragraph,
// a note or a table cell wrapped in lang="<content>", so the browser draws it
// in a face for that language and a screen reader speaks it in that voice
// instead of the page's. When the Book also declares a tool that reads, each
// run is a real <button type="button"> in the line of text, and pressing it
// opens a native <dialog> holding that tool's frame, loaded with the run.
//
// Three rules keep this from hurting what it sits beside:
//
//  - The sheet never repaints the view and never touches js/render-mount.js,
//    so opening it cannot destroy a mounted exercise. js/events.js leaves an
//    Escape pressed inside an open dialog to the dialog, which is what keeps
//    that same key from closing the drill underneath.
//  - The text sent is the run's own text, which came from the Book. Nothing a
//    learner typed is ever handed to the frame or put in a link.
//  - The dialog is built once per Book and kept, so a second tap reuses a
//    frame that is already awake instead of booting another.

import { state } from './state.js';
import { t, ui } from './i18n.js';
import { h } from './utils.js';
import { runsFor, splitRuns, contentLang, readingTool } from './book-tools.js';
import { mountYomuEmbed } from './yomu-host.js';

/** index.html's hidden line that tells assistive tech what a run does. */
const HINT_ID = 'rn-run-hint';
const EMBEDS = { yomu: mountYomuEmbed };

let sheet = null;   // { dialog, title, closeBtn, run, embed, bookId, toolId, returnTo }

/**
 * A string as page content: the text itself when the open Book marks no runs
 * in it, else an array of strings and elements for h() to append. Runs are
 * spans, or buttons when the Book has a tool that reads and `tap` is not
 * false. A heading passes tap: false: it is a landmark a reader jumps
 * between, not a line they read through, so it gets the language only.
 */
export function langRuns(book, text, { tap = true } = {}) {
  if (typeof text !== 'string' || !text) return text;
  const re = runsFor(book);
  const lang = contentLang(book);
  if (!re || !lang) return text;
  const parts = splitRuns(text, re);
  if (!parts.some((p) => typeof p !== 'string')) return text;
  tap = tap && !!readingTool(book);
  return parts.map((p) => (typeof p === 'string' ? p : runNode(p.run, lang, tap)));
}

function runNode(text, lang, tap) {
  if (!tap) return h('span', { lang }, text);
  return h('button', {
    type: 'button',
    class: 'rn-run',
    lang,
    'data-action': 'read-run',
    'aria-describedby': HINT_ID,
  }, text);
}

function buildSheet(book, tool) {
  const titleId = 'rn-sheet-title';
  const title = h('h2', { class: 'rn-sheet-title', id: titleId });
  const closeBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', 'data-action': 'close-reader' });
  const run = h('p', { class: 'rn-sheet-run' });
  const host = h('div', { class: 'rn-sheet-host' });
  const dialog = h('dialog', { class: 'rn-sheet', 'aria-labelledby': titleId }, h('div', { class: 'rn-sheet-inner' }, [
    h('header', { class: 'rn-sheet-head' }, [
      tool.glyph ? h('span', { class: 'rn-sheet-glyph', 'aria-hidden': 'true' }, tool.glyph) : null,
      title,
      closeBtn,
    ]),
    h('div', { class: 'rn-sheet-body' }, [run, host]),
  ]));
  document.body.appendChild(dialog);

  // A press on the backdrop reaches the dialog itself, never one of its
  // children, because the inner box fills it edge to edge.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  // Escape (the dialog's cancel), the close button and the backdrop all end
  // here, so focus goes back to the run that opened the sheet on every path.
  dialog.addEventListener('close', () => returnFocus());

  const mount = EMBEDS[tool.embed];
  const embed = mount({ host, title: `${t(tool.title)} - Yomu`, cls: 'rn-yomu--sheet' });
  return { dialog, title, closeBtn, run, embed, bookId: book.id, toolId: tool.id, returnTo: null };
}

function dropSheet() {
  if (!sheet) return;
  try { sheet.embed.destroy(); } catch (e) { console.error('[runcible] reader teardown failed', e); }
  if (sheet.dialog.open) sheet.dialog.close();
  sheet.dialog.remove();
  sheet = null;
}

/**
 * The run's own button when it is still on the page. A repaint while the sheet
 * was open (a sync merge) rebuilds the view, so the same run is found again by
 * its page and its text; failing that, focus goes to the main region rather
 * than being lost on a node that is no longer in the document.
 */
function returnFocus() {
  const back = sheet && sheet.returnTo;
  if (!back) return;
  sheet.returnTo = null;
  let target = back.node && back.node.isConnected ? back.node : null;
  if (!target && back.page) {
    const page = document.getElementById(back.page);
    target = page ? [...page.querySelectorAll('.rn-run')].find((b) => b.textContent === back.text) || null : null;
  }
  if (!target) target = document.getElementById('main');
  if (!target) return;
  try { target.focus({ preventScroll: true }); } catch { target.focus(); }
}

/** Open the sheet on a run's text. `trigger` is the button that was pressed. */
export function openReader(text, trigger) {
  const book = state.book;
  const tool = readingTool(book);
  const body = String(text || '').trim();
  if (!tool || !body) return false;
  if (sheet && (sheet.bookId !== book.id || sheet.toolId !== tool.id)) dropSheet();
  if (!sheet) sheet = buildSheet(book, tool);

  // Relabelled on every open, because the reader may have switched language
  // since the sheet was built.
  sheet.title.textContent = t(tool.title);
  sheet.closeBtn.textContent = ui('closeExercise');
  sheet.run.textContent = body;
  sheet.run.lang = contentLang(book) || '';
  sheet.embed.setLang(state.prefs.lang);
  const page = trigger && trigger.closest ? trigger.closest('[id]') : null;
  sheet.returnTo = { node: trigger || null, page: page ? page.id : null, text: body };
  if (!sheet.dialog.open) sheet.dialog.showModal();
  sheet.embed.load(body);
  return true;
}

/** Close the sheet, if it is open. Focus returns through the close event. */
export function closeReader() {
  if (sheet && sheet.dialog.open) sheet.dialog.close();
}

// A route change is a different page, so the sheet does not follow the reader
// there, and the run it would hand focus back to is gone.
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (!sheet || !sheet.dialog.open) return;
    sheet.returnTo = null;
    sheet.dialog.close();
  });
}

// ── The feedback panel ─────────────────────────────────────────────────────
//
// An exercise explains an answer inside its own .rx-feedback live region,
// which the engine builds and the shell does not edit. So the runs there are
// marked from outside, after the fact: one observer on the view, acting only
// on text inside a feedback panel, wrapping runs in a lang span (never a
// button: a panel is read, not browsed). It is safe against the engine
// because the engine never keeps a text node it wrote: the verdict is set
// with textContent and the explanation is replaced whole. It terminates
// because text already inside a marked span is skipped, so its own edits
// find nothing left to wrap.

let watching = false;

/** Start marking runs inside exercise feedback under `root`. Idempotent. */
export function watchFeedback(root) {
  if (watching || !root || typeof MutationObserver !== 'function') return;
  watching = true;
  new MutationObserver((records) => {
    const book = state.book;
    const re = runsFor(book);
    const lang = contentLang(book);
    if (!re || !lang) return;
    const panels = new Set();
    for (const rec of records) {
      const node = rec.target.nodeType === 1 ? rec.target : rec.target.parentElement;
      const panel = node && node.closest ? node.closest('.rx-feedback') : null;
      if (panel) panels.add(panel);
    }
    for (const panel of panels) markPanel(panel, re, lang);
  }).observe(root, { childList: true, subtree: true, characterData: true });
}

function markPanel(panel, re, lang) {
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
  const texts = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const marked = n.parentElement && n.parentElement.closest('[lang]');
    if (marked && panel.contains(marked)) continue;
    texts.push(n);
  }
  for (const node of texts) {
    const parts = splitRuns(node.data, re);
    if (!parts.some((p) => typeof p !== 'string')) continue;
    const frag = document.createDocumentFragment();
    for (const p of parts) frag.appendChild(typeof p === 'string' ? document.createTextNode(p) : h('span', { lang }, p.run));
    node.replaceWith(frag);
  }
}
