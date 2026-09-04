// The Rappel embed host. Contract C6, worked example C6.6.
//
// Runcible never imports Rappel's JS (DESIGN invariant 1). The whole coupling
// is an iframe URL and a postMessage vocabulary, and both are C6.
//
// Three things in here are load bearing, and each of them is a bug class:
//
//  1. e.origin is checked before anything else, and a message whose v we do not
//     know is dropped. C6.7: an engine that bumps to v: 2 keeps emitting v: 1
//     for one release, and a host ignores what it does not understand.
//  2. rappel:hello is posted on iframe load, because the engine can become
//     ready before this listener is attached. Without it the panel is
//     intermittently blank, which is the race C6.3 exists to close.
//  3. Every rappel:answer becomes a C2.3 attempt with source 'rappel'. That
//     conversion is the entire mechanism by which a review counts toward a
//     chapter goal. If it silently stopped, decks would still work, chapters
//     would stop unlocking, and nothing would error. So a malformed answer is
//     said out loud, on the page, not swallowed.

import { state } from './state.js';
import { assertDeclared } from './books.js';
import { recordAttempt, noteDeckCounts } from './progress.js';
import { ui } from './i18n.js';
import { h, clear } from './utils.js';

const PROD_ORIGIN = 'https://rappel.neorgon.com';
const LOCAL_PORT = '8879';
const ROOT = new URL('./', document.baseURI);

/**
 * Which engine to embed.
 * Local dev is not a fallback: PLAN's verification expectations require the
 * embed to be exercised across two real local origins, 8878 embedding 8879,
 * and C6.4's allowlist has a localhost clause for exactly that.
 */
export function rappelOrigin(loc = location) {
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
    return `${loc.protocol}//${loc.hostname}:${LOCAL_PORT}`;
  }
  return PROD_ORIGIN;
}

/** The C6.1 URL for a deck exercise spec. `embed` false gives the escape link. */
export function deckUrl(spec, { embed = true } = {}) {
  const url = new URL('/', rappelOrigin());
  const p = url.searchParams;
  if (embed) p.set('embed', '1');
  p.set('mode', spec.mode || 'review');
  if (Number.isInteger(spec.limit) && spec.limit > 0) p.set('limit', String(spec.limit));
  // Exactly one of deck, src or #d= must be present, C6.1. This host always
  // uses src, because a Book's deck is a file on Runcible's own origin.
  p.set('src', new URL(spec.src, ROOT).href);
  p.set('lang', state.prefs.lang);
  const theme = document.documentElement.dataset.theme;
  if (theme) p.set('theme', theme);
  return url.href;
}

/**
 * Mount a Rappel session into a host element. This is the seam the exercise
 * engine's `deck` type calls (js/exercises/types/deck.js): that type owns the
 * C2 mount signature and hands the host over whole, this owns the embed
 * contract. There is one implementation of C6 and it is here.
 *
 * @param {{ host: HTMLElement, spec: object, api: object,
 *           ctx: { bookId?: string, chapterId?: string, rungId?: string } }} arg
 * @returns {{ destroy: () => void }}
 */
export function mountDeckEmbed({ host, spec, api, ctx }) {
  const where = ctx || {};
  const book = state.book;
  if (!book) throw new Error(`deck "${spec.id}": no Book is open, so an attempt could not be attributed`);
  if (where.bookId && where.bookId !== book.id) {
    throw new Error(`deck "${spec.id}": mounted for Book "${where.bookId}" while "${book.id}" is open`);
  }
  const chapterId = where.chapterId || (state.chapter && state.chapter.id);
  if (!chapterId) throw new Error(`deck "${spec.id}": no chapter context, so an attempt could not be attributed`);
  // C1.3 rule 2 applies to a deck src exactly as it does to a data pointer.
  assertDeclared(book, spec.src, `exercise ${spec.id}`);

  const origin = rappelOrigin();
  const status = h('p', { class: 'rn-deck-status', role: 'status' }, ui('loading'));
  const warn = h('p', { class: 'rn-deck-warn', hidden: true, role: 'alert' });
  const frame = h('iframe', {
    class: 'rn-deck',
    src: deckUrl(spec),
    title: `${api.t(spec.title) || spec.id} - Rappel`,
    loading: 'lazy',
  });
  // C6.5. The escape link is rendered beside every deck exercise by render.js,
  // whether or not a frame is mounted, so this bar carries only the state the
  // engine reports.
  clear(host);
  host.appendChild(h('div', { class: 'rn-deck-wrap' }, [
    frame,
    h('div', { class: 'rn-deck-bar' }, [status]),
    warn,
  ]));

  const say = (text) => { status.textContent = text; };
  const shout = (text) => { warn.textContent = text; warn.hidden = false; };
  let heard = false;

  function onMessage(e) {
    if (e.origin !== origin) return;
    if (e.source !== frame.contentWindow) return;
    const m = e.data;
    if (!m || typeof m !== 'object' || m.v !== 1) return;
    heard = true;

    if (m.type === 'rappel:ready' || m.type === 'rappel:due') {
      noteDeckCounts(book.id, spec.src, { due: m.due, new: m.new, total: m.total });
      say(counts(m));
      if (m.type === 'rappel:ready' && m.ledger === 'ephemeral') shout(ui('notSaved'));
      return;
    }
    if (m.type === 'rappel:answer') {
      // The skill recorded is the exercise spec's own (below), so the engine's
      // skill is informational and its absence is not a refusal.
      const bad = !m.itemId || typeof m.correct !== 'boolean';
      if (bad) {
        // Loud, on the page. An answer with no item or no verdict cannot become
        // evidence, and the failure is otherwise completely invisible.
        console.error('[runcible] rappel:answer without itemId, skill or correct', m);
        shout(ui('deckNoSkill'));
        return;
      }
      // The attempt counts toward the skill the chapter author put on the deck
      // spec. The engine's `m.skill` is the deck template's own name, which is
      // deck-internal so a deck stays reusable across Books; recording under it
      // sent every deck review to a name no goal reads (QA, 2026-09-04).
      // tools/validate-book.mjs checks the spec's skill is one this Book knows.
      recordAttempt(
        { itemId: m.itemId, skill: spec.skill || m.skill, correct: m.correct, ms: Number(m.ms) || 0 },
        { bookId: book.id, chapterId, exerciseId: spec.id, source: 'rappel' },
      );
      return;
    }
    if (m.type === 'rappel:session-end') {
      // session-end carries due and new too, so the Today badge is current even
      // if the engine's next rappel:due never arrives.
      noteDeckCounts(book.id, spec.src, { due: m.due, new: m.new });
      say(counts(m));
      if (typeof api.done === 'function') {
        api.done({ exerciseId: spec.id, type: 'deck', answered: m.answered,
          accuracy: m.answered ? (m.answered - (m.again || 0)) / m.answered : null });
      }
      return;
    }
    if (m.type === 'rappel:error') {
      console.error('[runcible] rappel:error', m.code, m.message);
      shout(`${ui('deckError')}: ${m.code}`);
      return;
    }
    if (m.type === 'rappel:resize' && Number.isFinite(m.height)) {
      frame.style.height = `${Math.max(240, Math.min(1200, m.height))}px`;
    }
  }

  function onLoad() {
    // C6.3. The engine may already be ready, so ask it to say so again. A frame
    // that failed to load has an opaque origin and this throws rather than
    // reaching anything, which the silence timer below is what reports.
    try {
      frame.contentWindow?.postMessage({ v: 1, type: 'rappel:hello' }, origin);
    } catch (e) {
      console.error('[runcible] could not greet the engine', e);
    }
  }

  window.addEventListener('message', onMessage);
  frame.addEventListener('load', onLoad);

  // An engine that is unreachable sends nothing at all, so neither rappel:error
  // nor the frame's own message ever arrives and the panel sits on "Loading"
  // forever. Silence is the one failure the C6 vocabulary cannot report, so the
  // host times it and says so, pointing at the link that does not need the
  // frame.
  const silence = setTimeout(() => {
    if (heard) return;
    say(ui('deckSilent'));
    shout(ui('deckSilentDetail'));
  }, 8000);

  return {
    destroy() {
      clearTimeout(silence);
      window.removeEventListener('message', onMessage);
      frame.removeEventListener('load', onLoad);
      clear(host);
    },
  };
}

function counts(m) {
  const parts = [];
  if (Number.isFinite(m.due)) parts.push(`${m.due} ${ui('due')}`);
  if (Number.isFinite(m.new)) parts.push(`${m.new} ${ui('fresh')}`);
  if (Number.isFinite(m.total)) parts.push(`${m.total} ${ui('total')}`);
  return parts.length ? parts.join(' · ') : ui('loading');
}
