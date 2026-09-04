// ── deck ─────────────────────────────────────────────────────
// C2.1: an embedded Rappel session. Graded, from rappel:answer.
// Required spec field: src. Optional: limit, mode.
//
// The iframe, the C6.4 origin filtering, the C6.3 hello handshake and the
// "Open in Rappel" escape link of C6.5 belong to the shell's embed host, which
// PLAN assigns to A1a as js/embed.js. This type is the join between the two
// workstreams, not a second implementation of the embed contract: A1a converts
// rappel:answer into a C2.3 attempt, and this file hands it the host element
// and the api to do it with.
//
// The seam, as js/embed.js exports it:
//
//   export function mountDeckEmbed({ host, spec, api, ctx }) -> { destroy() }
//
//     host  an element this type owns and hands over whole
//     spec  the deck exercise: { id, type, skill, src, limit, mode, ... }
//     api   the frozen C2.3 api
//     ctx   { bookId, chapterId, rungId }, passed through untouched. embed.js
//           refuses a deck it cannot attribute an attempt to.
//
// Every rappel:answer becomes exactly one C2.3 attempt with source 'rappel'.
// That conversion is embed.js's, not this file's.
//
// A missing module or a missing export is reported by name, on the page and on
// the console, and nothing is recorded. It does not draw a frame of its own and
// it does not quietly pass: a deck exercise that renders but stops feeding
// rappel:answer is the exact silent failure C6.7 warns about.

import { el, append, clear } from '../dom.js';
import { chrome } from '../strings.js';

// Two levels up: this file is js/exercises/types/, the shell's host is js/.
const EMBED_MODULE = '../../embed.js';
const EMBED_EXPORT = 'mountDeckEmbed';

function report(host, spec, api, message) {
  clear(host);
  append(host, el('section', { class: 'rx rx--deck', dataset: { exercise: spec.id || '' } }, [
    el('p', { class: 'rx-error', text: chrome(api && api.t, 'deckNotWired') }),
    el('p', { class: 'rx-error-detail', text: message }),
  ]));
  console.error(`[runcible] deck exercise "${spec.id}": ${message}`);
}

export function mount(host, spec, api, ctx) {
  let alive = true;
  let handle = null;

  import(EMBED_MODULE)
    .then((mod) => {
      if (!alive) return;
      const fn = mod && mod[EMBED_EXPORT];
      if (typeof fn !== 'function') {
        report(host, spec, api, `js/embed.js does not export ${EMBED_EXPORT}({ host, spec, api, ctx }).`);
        return;
      }
      try {
        handle = fn({ host, spec, api, ctx });
      } catch (err) {
        report(host, spec, api, `js/embed.js refused this deck: ${err && err.message ? err.message : err}`);
      }
    })
    .catch((err) => {
      if (!alive) return;
      report(host, spec, api, `js/embed.js could not be loaded: ${err && err.message ? err.message : err}`);
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
