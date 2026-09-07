// The Quiz embed host. Contract neo-quiz-embed/1, published at
// quiz.neorgon.com/llms.txt and shaped after C6, the Rappel embed that
// js/embed.js implements. This is the second embed host, and it is a copy of
// the first on purpose: the two engines share no code with Runcible or with
// each other, so the host side is the same iframe, the same handshake and the
// same conversion, with the vocabulary renamed.
//
// Runcible never imports Quiz's JS. The whole coupling is an iframe URL and a
// postMessage vocabulary, and both are written down in the engine's llms.txt.
//
// Three things in here are load bearing, and each of them is a bug class:
//
//  1. e.origin and e.source are checked before anything else, and a message
//     whose v this host does not know is dropped. The two sites deploy
//     separately, so an engine that bumps to v: 2 keeps emitting v: 1 for one
//     release, and a host ignores what it does not understand.
//  2. quiz:hello is posted on iframe load, because the engine can be ready
//     before this listener is attached. Without it the panel is intermittently
//     blank, which is the race the hello exists to close.
//  3. Every quiz:answer becomes one C2.3 attempt under the SPEC's skill, with
//     source 'quiz'. That conversion is the entire mechanism by which a game
//     counts toward a chapter goal. If it silently stopped, games would still
//     play, chapters would stop unlocking, and nothing would error. So an
//     answer that cannot be read, or cannot be recorded, is said out loud on
//     the page, and a round with lost answers, or one the learner left before
//     its end (session-end with complete: false, or answered under total), is
//     never reported as finished.
//
// The strings live here and not in js/exercises/strings.js or js/i18n.js,
// which belong to other workstreams. They still resolve through i18n's t(), so
// the page's honesty line learns about a fallback the same way as any content.

import { state } from './state.js';
import { assertDeclared } from './books.js';
import { recordAttempt } from './progress.js';
import { t } from './i18n.js';
import { h, clear } from './utils.js';

export const PROTOCOL_VERSION = 1;
const PROD_ORIGIN = 'https://quiz.neorgon.com';
const LOCAL_PORT = '8880';
const SILENCE_MS = 8000;

/** The games Quiz ships. spec.js refuses any other before a mount. */
export const GAMES = Object.freeze(['beats', 'sound', 'pairs', 'order']);

const STRINGS = Object.freeze({
  loading: { en: 'Loading the game', es: 'Cargando el juego' },
  open: { en: 'Open in Quiz', es: 'Abrir en Quiz' },
  ready: { en: '{name}: {total} items', es: '{name}: {total} elementos' },
  recorded: { en: '{n} of {total} recorded', es: '{n} de {total} registradas' },
  ended: { en: 'Round recorded: {correct} of {total} right', es: 'Ronda registrada: {correct} de {total} correctas' },
  notSaved: {
    en: 'This frame does not keep Quiz\'s own scores. Your answers still count here.',
    es: 'Este marco no guarda los resultados propios de Quiz. Tus respuestas sí cuentan aquí.',
  },
  badAnswer: {
    en: 'The game sent an answer this page could not read, so it was not recorded.',
    es: 'El juego envió una respuesta que esta página no pudo leer, así que no se registró.',
  },
  notRecorded: { en: 'An answer was not recorded: {reason}', es: 'Una respuesta no se registró: {reason}' },
  lost: {
    en: '{n} of {total} answers were not recorded, so this round does not count as finished.',
    es: '{n} de {total} respuestas no se registraron, así que esta ronda no cuenta como terminada.',
  },
  left: {
    en: 'Left after {n} of {total}: the answers are recorded, the round is not finished.',
    es: 'Abandonada tras {n} de {total}: las respuestas quedan registradas, la ronda no está terminada.',
  },
  error: { en: 'Quiz reported a problem', es: 'Quiz informó un problema' },
  silent: { en: 'No answer from Quiz', es: 'Quiz no responde' },
  silentDetail: {
    en: 'The game frame did not load. Open in Quiz still works.',
    es: 'El marco del juego no cargó. Abrir en Quiz sigue funcionando.',
  },
});

/** One of this file's strings in the reader's language, {name} filled as text. */
function s(key, vars) {
  let out = t(STRINGS[key]);
  if (typeof out !== 'string' || out === '') out = STRINGS[key].en;
  for (const name of Object.keys(vars || {})) {
    const v = vars[name];
    out = out.split(`{${name}}`).join(v === null || v === undefined ? '' : String(v));
  }
  return out;
}

/**
 * Which engine to embed. The same rule as rappelOrigin(): local dev is not a
 * fallback, it is the second real origin the allowlist's localhost clause
 * exists for, http://localhost:8878 embedding http://localhost:8880.
 */
export function quizOrigin(loc = location) {
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
    return `${loc.protocol}//${loc.hostname}:${LOCAL_PORT}`;
  }
  return PROD_ORIGIN;
}

/**
 * The engine URL for a quiz spec. With embed it is the frame's src:
 * ?embed=1&game=&set=<absolute src>&skill=&lang=&limit=[&theme=]. Without it
 * it is the escape link: the same URL minus embed and skill, which is what the
 * engine's own bar offers, so both links land on one standalone round.
 *
 * The env argument exists so a node test can build the URL with no DOM.
 */
export function quizUrl(spec, { embed = true } = {}, env = {}) {
  const loc = env.loc || location;
  const root = new URL('./', env.baseURI || document.baseURI);
  const lang = env.lang || state.prefs.lang;
  const theme = env.theme !== undefined ? env.theme : document.documentElement.dataset.theme;
  const url = new URL('/', quizOrigin(loc));
  const p = url.searchParams;
  if (embed) p.set('embed', '1');
  p.set('game', spec.game);
  p.set('set', new URL(spec.src, root).href);
  if (embed && spec.skill) p.set('skill', spec.skill);
  if (lang) p.set('lang', lang);
  if (Number.isInteger(spec.limit) && spec.limit > 0) p.set('limit', String(spec.limit));
  if (theme) p.set('theme', theme);
  return url.href;
}

/**
 * The gate every inbound message passes before it is read: the engine's
 * origin, the frame's own window, a version this host knows, a quiz: type.
 * Pure, so the negative cases have a node test.
 */
export function acceptable(event, origin, frameWindow) {
  if (!event || event.origin !== origin) return false;
  if (frameWindow && event.source !== frameWindow) return false;
  const m = event.data;
  if (!m || typeof m !== 'object' || m.v !== PROTOCOL_VERSION) return false;
  return typeof m.type === 'string' && m.type.startsWith('quiz:');
}

/**
 * One quiz:answer as a C2.3 attempt, or the reason it cannot be one.
 * The skill recorded is the spec's own: the engine's is informational, and
 * recording under it is exactly how the decks lost every review (QA,
 * 2026-09-04). chosen and expected are strings in the contract and are kept
 * only as strings, because a recorded answer is what weak-item review shows
 * back to the learner.
 */
export function readAnswer(m, spec) {
  if (!m || typeof m !== 'object') return { ok: false, reason: 'not an object' };
  if (typeof m.itemId !== 'string' || m.itemId === '') return { ok: false, reason: 'itemId is missing' };
  if (typeof m.correct !== 'boolean') return { ok: false, reason: 'correct is not true or false' };
  const ms = Number(m.ms);
  const attempt = {
    itemId: m.itemId,
    skill: (spec && spec.skill) || m.skill,
    correct: m.correct,
    ms: Number.isFinite(ms) && ms >= 0 ? ms : 0,
  };
  if (typeof m.chosen === 'string') attempt.answer = m.chosen;
  if (typeof m.expected === 'string') attempt.expected = m.expected;
  return { ok: true, attempt };
}

/**
 * Mount a Quiz round into a host element. This is the seam the exercise
 * engine's `quiz` type calls (js/exercises/types/quiz.js): that type owns the
 * C2 mount signature and hands the host over whole, this owns the embed
 * contract. There is one implementation of the Quiz host and it is here.
 *
 * @param {{ host: HTMLElement, spec: object, api: object,
 *           ctx: { bookId?: string, chapterId?: string, rungId?: string } }} arg
 * @returns {{ destroy: () => void }}
 */
export function mountQuizEmbed({ host, spec, api, ctx }) {
  const where = ctx || {};
  const book = state.book;
  if (!book) throw new Error(`quiz "${spec.id}": no Book is open, so an attempt could not be attributed`);
  if (where.bookId && where.bookId !== book.id) {
    throw new Error(`quiz "${spec.id}": mounted for Book "${where.bookId}" while "${book.id}" is open`);
  }
  const chapterId = where.chapterId || (state.chapter && state.chapter.id);
  if (!chapterId) throw new Error(`quiz "${spec.id}": no chapter context, so an attempt could not be attributed`);
  if (!GAMES.includes(spec.game)) {
    throw new Error(`quiz "${spec.id}": "${spec.game}" is not one of ${GAMES.join(', ')}`);
  }
  // C1.3 rule 2 applies to a quiz src exactly as it does to a deck src.
  assertDeclared(book, spec.src, `exercise ${spec.id}`);

  const origin = quizOrigin();
  const title = api.t(spec.title) || spec.id;
  const status = h('p', { class: 'rn-deck-status', role: 'status' }, s('loading'));
  // The escape link is in the bar before the frame has loaded and stays there
  // whatever the frame does: a link to the top-level origin is the one path
  // that always works. render.js draws the deck's beside Start; this host
  // draws its own, so a game that never loads still has a way out.
  const open = h('a', {
    class: 'rn-deck-out',
    href: quizUrl(spec, { embed: false }),
    target: '_blank',
    rel: 'noopener noreferrer',
  }, s('open'));
  const warn = h('p', { class: 'rn-deck-warn', hidden: true, role: 'alert' });
  const frame = h('iframe', {
    class: 'rn-deck rn-quiz',
    src: quizUrl(spec),
    title: `${title} - Quiz`,
    loading: 'lazy',
  });
  clear(host);
  host.appendChild(h('div', { class: 'rn-deck-wrap' }, [
    frame,
    h('div', { class: 'rn-deck-bar' }, [status, open]),
    warn,
  ]));

  const say = (text) => { status.textContent = text; };
  const shout = (text) => { warn.textContent = text; warn.hidden = false; };
  let heard = false;
  let total = null;
  let answered = 0;
  let right = 0;
  let lost = 0;

  function onMessage(e) {
    if (!acceptable(e, origin, frame.contentWindow)) return;
    heard = true;
    const m = e.data;

    if (m.type === 'quiz:ready') {
      total = Number.isFinite(m.total) ? m.total : null;
      say(s('ready', { name: typeof m.name === 'string' && m.name ? m.name : title, total: total === null ? '?' : total }));
      if (m.store === 'ephemeral') shout(s('notSaved'));
      return;
    }
    if (m.type === 'quiz:answer') {
      const read = readAnswer(m, spec);
      if (!read.ok) {
        // Loud, on the page. An answer with no item or no verdict cannot become
        // evidence, and the failure is otherwise completely invisible.
        console.error(`[runcible] quiz:answer dropped, ${read.reason}`, m);
        lost += 1;
        shout(s('badAnswer'));
        return;
      }
      try {
        recordAttempt(read.attempt, { bookId: book.id, chapterId, exerciseId: spec.id, source: 'quiz' });
      } catch (err) {
        // The recorder refused it. The reason is the shell's own message, which
        // names the field or the rule, and the round is not finished below.
        console.error('[runcible] quiz:answer was not recorded', err);
        lost += 1;
        shout(s('notRecorded', { reason: err && err.message ? err.message : String(err) }));
        return;
      }
      answered += 1;
      if (m.correct) right += 1;
      // The bar counts what THIS page recorded, not what the frame asked: the
      // frame shows its own progress, and a bridge that broke is visible only
      // when the two numbers stop agreeing.
      say(s('recorded', { n: answered, total: total === null ? answered : total }));
      return;
    }
    if (m.type === 'quiz:session-end') {
      const n = Number.isFinite(m.answered) ? m.answered : answered;
      const c = Number.isFinite(m.correct) ? m.correct : right;
      // A round the learner left early (the engine posts total and
      // complete: false; an older engine posts neither, and then total from
      // quiz:ready is the check). The answers already recorded stand as
      // evidence; api.done would tick an exercise that was not finished.
      const want = Number.isFinite(m.total) ? m.total : total;
      if (m.complete === false || (Number.isFinite(want) && n < want)) {
        say(s('left', { n, total: want === null ? '?' : want }));
        return;
      }
      if (lost) {
        // api.done would clear this host and draw a tick beside a round whose
        // evidence never landed. The warning stays on the page instead, and
        // the status keeps its last honest count rather than saying "recorded".
        console.error(`[runcible] quiz "${spec.id}": ${lost} of ${n} answers were not recorded`);
        shout(s('lost', { n: lost, total: n }));
        return;
      }
      say(s('ended', { correct: c, total: n }));
      if (typeof api.done === 'function') {
        api.done({ exerciseId: spec.id, type: 'quiz', answered: n, accuracy: n ? c / n : null });
      }
      return;
    }
    if (m.type === 'quiz:error') {
      // The status line stops saying "Loading" beside an error: the two would
      // contradict each other, and the silence path below already sets both.
      console.error('[runcible] quiz:error', m.code, m.message);
      say(s('error'));
      shout(`${m.code}${typeof m.message === 'string' && m.message ? `. ${m.message}` : ''}`);
      return;
    }
    if (m.type === 'quiz:resize' && Number.isFinite(m.height)) {
      frame.style.height = `${Math.max(240, Math.min(1200, m.height))}px`;
    }
  }

  function onLoad() {
    // The engine may already be ready, so ask it to say so again. A frame that
    // failed to load has an opaque origin and this throws rather than reaching
    // anything, which the silence timer below is what reports.
    try {
      frame.contentWindow?.postMessage({ v: PROTOCOL_VERSION, type: 'quiz:hello' }, origin);
    } catch (e) {
      console.error('[runcible] could not greet Quiz', e);
    }
  }

  window.addEventListener('message', onMessage);
  frame.addEventListener('load', onLoad);

  // An engine that is unreachable sends nothing at all, so neither quiz:error
  // nor the frame's own message ever arrives and the bar sits on "Loading"
  // forever. Silence is the one failure the vocabulary cannot report, so the
  // host times it and says so, pointing at the link that does not need the
  // frame.
  const silence = setTimeout(() => {
    if (heard) return;
    say(s('silent'));
    shout(s('silentDetail'));
  }, SILENCE_MS);

  return {
    destroy() {
      clearTimeout(silence);
      window.removeEventListener('message', onMessage);
      frame.removeEventListener('load', onLoad);
      clear(host);
    },
  };
}
