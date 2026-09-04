// ── read ─────────────────────────────────────────────────────
// C2.1: one or more pages. Not graded, correct: null.
// Required spec field: pages[].
//
// It still records. C3.4: "correct: null attempts count toward nothing, so
// clicking through pages never passes a chapter." The record exists so the
// Today view can tell a page that was opened from one that was not, and ms is
// the dwell time on that page, which is the only honest thing a reader
// produces.

import { createSession } from '../session.js';
import { el, append, button, clear, focus } from '../dom.js';
import { renderPage } from './page.js';
import { resolveList } from '../items.js';
import { ExerciseError } from '../errors.js';

export function mount(host, spec, api, ctx) {
  const session = createSession(host, spec, api, ctx);
  let alive = true;

  (async () => {
    const pages = Array.isArray(spec.pages) ? spec.pages : null;
    if (!pages || pages.length === 0) {
      throw new ExerciseError('a read exercise needs a pages array with at least one page', ctx, spec);
    }
    for (const p of pages) {
      if (typeof p === 'string') {
        throw new ExerciseError(
          `pages[] holds the string "${p}". A read exercise carries whole page objects (C3.3), not page ids`, ctx, spec);
      }
    }

    // A table page may point at data. Resolve those once, before the reader
    // starts, so turning a page never waits on the network.
    const tableItems = new Map();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (p.kind === 'table' && !Array.isArray(p.rows) && p.items) {
        tableItems.set(i, await resolveList(p.items, api, ctx, spec, `pages[${i}].items`));
      }
    }
    if (!alive) return;

    session.setTotal(pages.length);
    let index = 0;
    const seen = new Set();
    let shownAt = performance.now();

    const recordDwell = () => {
      const page = pages[index];
      const id = page.id || `${spec.id}#page${index}`;
      const key = `${index}`;
      const ms = performance.now() - shownAt;
      if (seen.has(key)) return;
      seen.add(key);
      session.record({ itemId: id, correct: null, ms, hintUsed: false });
    };

    const draw = () => {
      clear(session.stage);
      clear(session.foot);
      const holder = el('article', { class: 'rx-page stack stack--tight' });
      renderPage(holder, pages[index], session.t, tableItems.get(index) || null, api.lang);
      append(session.stage, holder);
      session.step(index + 1);
      shownAt = performance.now();

      const back = button(session.s('back'), () => { if (index > 0) { index -= 1; draw(); } }, {
        class: 'btn btn--ghost',
      });
      back.disabled = index === 0;
      const last = index === pages.length - 1;
      const on = button(last ? session.s('finish') : session.s('next'), () => {
        recordDwell();
        if (last) { session.finish(); return; }
        index += 1;
        draw();
      }, { class: 'btn btn--primary' });
      append(session.foot, [back, on]);
      focus(on);
    };

    session.on(document, 'keydown', (e) => {
      if (e.defaultPrevented) return;
      if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); index -= 1; draw(); }
    });

    draw();
  })().catch((err) => { if (alive) session.fail(err); });

  return { destroy() { alive = false; session.destroy(); } };
}
