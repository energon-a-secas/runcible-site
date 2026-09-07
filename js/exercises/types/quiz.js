// ── quiz ─────────────────────────────────────────────────────
// A Quiz game embedded from quiz.neorgon.com. Graded, from quiz:answer.
// Required spec fields: game, src. Optional: limit.
//
// The second embed host, and the same shape as deck on purpose. The iframe,
// the origin and source checks, the quiz:hello handshake, the silence timer
// and the "Open in Quiz" link belong to js/quiz-host.js. This type is the join
// between the exercise engine and that host, not a second implementation of
// the contract: quiz-host.js converts quiz:answer into a C2.3 attempt, and
// this file hands it the host element and the api to do it with.
//
// The seam, as js/quiz-host.js exports it:
//
//   export function mountQuizEmbed({ host, spec, api, ctx }) -> { destroy() }
//
//     host  an element this type owns and hands over whole
//     spec  the quiz exercise: { id, type, skill, game, src, limit, ... }
//     api   the frozen C2.3 api
//     ctx   { bookId, chapterId, rungId }, passed through untouched. The host
//           refuses a game it cannot attribute an attempt to.
//
// Every quiz:answer becomes exactly one C2.3 attempt with source 'quiz'. That
// conversion is quiz-host.js's, not this file's.
//
// A missing module or a missing export is reported by name, on the page and on
// the console, and nothing is recorded. It draws no frame of its own and never
// quietly passes: a game that renders but stops feeding quiz:answer is the
// silent failure C6.7 warns about, in a second coat of paint.
//
// The one string this type owns lives here rather than in strings.js: that
// file is another workstream's, and the line is shown precisely when the host
// module failed to load, so it cannot come from there either.

import { el, append, clear } from '../dom.js';

// Two levels up: this file is js/exercises/types/, the shell's host is js/.
const HOST_MODULE = '../../quiz-host.js';
const HOST_EXPORT = 'mountQuizEmbed';

const NOT_WIRED = Object.freeze({
  en: 'This game is not wired up yet.',
  es: 'Este juego todavía no está conectado.',
});

/** Through api.t, so a Spanish reader's fallback is counted like any other. */
function notWired(api) {
  const out = api && typeof api.t === 'function' ? api.t(NOT_WIRED) : '';
  return typeof out === 'string' && out !== '' ? out : NOT_WIRED.en;
}

function report(host, spec, api, message) {
  clear(host);
  append(host, el('section', { class: 'rx rx--quiz', dataset: { exercise: spec.id || '' } }, [
    el('p', { class: 'rx-error', text: notWired(api) }),
    el('p', { class: 'rx-error-detail', text: message }),
  ]));
  console.error(`[runcible] quiz exercise "${spec.id}": ${message}`);
}

export function mount(host, spec, api, ctx) {
  let alive = true;
  let handle = null;

  import(HOST_MODULE)
    .then((mod) => {
      if (!alive) return;
      const fn = mod && mod[HOST_EXPORT];
      if (typeof fn !== 'function') {
        report(host, spec, api, `js/quiz-host.js does not export ${HOST_EXPORT}({ host, spec, api, ctx }).`);
        return;
      }
      try {
        handle = fn({ host, spec, api, ctx });
      } catch (err) {
        report(host, spec, api, `js/quiz-host.js refused this game: ${err && err.message ? err.message : err}`);
      }
    })
    .catch((err) => {
      if (!alive) return;
      report(host, spec, api, `js/quiz-host.js could not be loaded: ${err && err.message ? err.message : err}`);
    });

  return {
    destroy() {
      alive = false;
      if (handle && typeof handle.destroy === 'function') handle.destroy();
      handle = null;
      clear(host);
    },
  };
}
