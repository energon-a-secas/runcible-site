// The Yomu embed host. Contract yomu-embed/1, written down in Yomu's own
// docs/EMBED.md, and built as a copy of js/quiz-host.js on purpose: the two
// sites share no code, so the host side is the same iframe, the same origin
// checks, the same hello on load and the same silence timer, with the
// vocabulary renamed.
//
// Runcible never imports Yomu's JS. The whole coupling is an iframe URL and a
// postMessage vocabulary.
//
// Four things in here are load bearing:
//
//  1. e.origin and e.source are checked before anything else, and a message
//     whose v this host does not know is dropped. Yomu does the same on its
//     side and answers only the origin of the last hello it accepted, so a
//     host that is not on Yomu's allowlist hears nothing and the silence
//     timer is what says so.
//  2. yomu:hello is posted on the iframe's load, because Yomu can be ready
//     before this listener is attached. Text is sent only after yomu:ready,
//     and sent again after a frame that reloaded says ready again.
//  3. Text never travels in the frame URL. It goes by yomu:load. The one
//     exception EMBED.md allows is the standalone link's #t= fragment, and
//     only for text this site authored (a Book's own content): standaloneUrl
//     is never handed anything a learner typed.
//  4. A tool records nothing. No message from Yomu becomes an attempt, so a
//     reader can never push earned evidence out of a C8.2 window.
//
// The strings live here, as they do in js/quiz-host.js, and resolve through
// i18n's t() so a missing Spanish line still counts toward the honesty note.

import { state } from './state.js';
import { t } from './i18n.js';
import { h, clear } from './utils.js';

export const PROTOCOL_VERSION = 1;
const PROD_ORIGIN = 'https://yomu.neorgon.com';
const LOCAL_PORT = '8895';
const SILENCE_MS = 8000;
/** EMBED.md: yomu:load takes at most this many characters. */
export const MAX_TEXT = 2000;
// A frame sized from the document inside it can chase its own height if that
// document is sized from the frame, so a change under two pixels is ignored
// and the height is held between these.
const MIN_HEIGHT = 240;
const MAX_HEIGHT = 6000;

const STRINGS = Object.freeze({
  loading: { en: 'Loading Yomu', es: 'Cargando Yomu' },
  open: { en: 'Open in Yomu', es: 'Abrir en Yomu' },
  ready: { en: 'Yomu is ready', es: 'Yomu está listo' },
  reading: { en: 'Reading', es: 'Leyendo' },
  read: { en: '{tokens} pieces read', es: '{tokens} piezas leídas' },
  readOne: { en: '1 piece read', es: '1 pieza leída' },
  readOneUnknown: {
    en: '1 piece read, with no dictionary entry',
    es: '1 pieza leída, sin entrada en el diccionario',
  },
  readUnknown: {
    en: '{tokens} pieces read, {unknown} with no dictionary entry',
    es: '{tokens} piezas leídas, {unknown} sin entrada en el diccionario',
  },
  clipped: {
    en: 'Only the first {n} characters were sent.',
    es: 'Solo se enviaron los primeros {n} caracteres.',
  },
  error: { en: 'Yomu reported a problem', es: 'Yomu informó un problema' },
  silent: { en: 'No answer from Yomu', es: 'Yomu no responde' },
  silentDetail: {
    en: 'The reader did not load here. Open in Yomu still works.',
    es: 'El lector no cargó aquí. Abrir en Yomu sigue funcionando.',
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
 * Which Yomu to embed. The same rule as rappelOrigin() and quizOrigin(): on
 * localhost or 127.0.0.1 the page embeds Yomu's dev server on the same host
 * name, which is the second real origin EMBED.md's allowlist has a clause for.
 */
export function yomuOrigin(loc = location) {
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
    return `${loc.protocol}//${loc.hostname}:${LOCAL_PORT}`;
  }
  return PROD_ORIGIN;
}

/**
 * The frame's src: ?embed=1&lang=<en|es>. lang only sets Yomu's interface
 * language; the text follows by message. The env argument exists so a node
 * test can build the URL with no DOM.
 */
export function yomuUrl({ lang } = {}, env = {}) {
  const url = new URL('/', yomuOrigin(env.loc || location));
  url.searchParams.set('embed', '1');
  const l = lang || env.lang || state.prefs.lang;
  if (l) url.searchParams.set('lang', l);
  return url.href;
}

/**
 * The escape link. With text it is EMBED.md's standalone form,
 * <origin>/#t=<encodeURIComponent(text)>, which Yomu reads once and then drops
 * from its own address bar. Only a Book's own text may be passed here: a
 * fragment ends up in history and in a copied link, and a learner's typed
 * answer must not.
 */
export function standaloneUrl(text, env = {}) {
  const base = new URL('/', yomuOrigin(env.loc || location)).href;
  const body = typeof text === 'string' ? clip(text.trim()).text : '';
  return body ? `${base}#t=${encodeURIComponent(body)}` : base;
}

/**
 * Text cut to MAX_TEXT UTF-16 units without splitting a surrogate pair, and
 * whether anything was cut. Pure, so the boundary has a node test.
 */
export function clip(text) {
  const str = String(text || '');
  if (str.length <= MAX_TEXT) return { text: str, clipped: false };
  let end = MAX_TEXT;
  const code = str.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return { text: str.slice(0, end), clipped: true };
}

/**
 * The gate every inbound message passes before it is read: Yomu's origin, the
 * frame's own window, a version this host knows, a yomu: type. Pure, so the
 * negative cases have a node test.
 */
export function acceptable(event, origin, frameWindow) {
  if (!event || event.origin !== origin) return false;
  if (frameWindow && event.source !== frameWindow) return false;
  const m = event.data;
  if (!m || typeof m !== 'object' || m.v !== PROTOCOL_VERSION) return false;
  return typeof m.type === 'string' && m.type.startsWith('yomu:');
}

/**
 * Mount a Yomu frame into a host element. Used twice: full width on a tool's
 * own page (js/render-tool.js), and inside the reading sheet a tapped run
 * opens (js/read-sheet.js), which calls load() with the run.
 *
 * If Yomu says nothing for eight seconds the frame is hidden and, in its
 * place, the page says so and offers Open in Yomu, the one path that needs no
 * frame. A message that arrives later puts the frame back.
 *
 * @param {{ host: HTMLElement, title: string, lang?: string, cls?: string }} arg
 * @returns {{ load(text: string): void, setLang(lang: string): void, destroy(): void }}
 */
export function mountYomuEmbed({ host, title, lang, cls }) {
  const origin = yomuOrigin();
  const urlLang = lang || state.prefs.lang;   // what the frame document boots in
  let wantLang = urlLang;                      // what the page is in now
  let want = '';        // the text the page wants read, already clipped
  let sent = null;      // the text the current frame document was sent
  let ready = false;
  let heard = false;
  let lastHeight = 0;
  let loads = 0;        // documents the frame has finished loading

  const frame = h('iframe', {
    class: 'rn-yomu-frame',
    src: yomuUrl({ lang: urlLang }),
    title,
  });
  const deadLink = h('a', { class: 'rn-textlink', href: standaloneUrl(''), target: '_blank', rel: 'noopener noreferrer' }, s('open'));
  // Not a live region of its own: the status line below announces the silence
  // once, and this block is what a sighted reader finds where the frame was.
  const dead = h('div', { class: 'rn-yomu-dead', hidden: true }, [
    h('p', { class: 'rn-yomu-dead-title' }, s('silent')),
    h('p', { class: 'rn-note' }, s('silentDetail')),
    deadLink,
  ]);
  const status = h('p', { class: 'rn-deck-status', role: 'status' }, s('loading'));
  const open = h('a', { class: 'rn-deck-out', href: standaloneUrl(''), target: '_blank', rel: 'noopener noreferrer' }, s('open'));
  const warn = h('p', { class: 'rn-deck-warn', hidden: true, role: 'alert' });
  clear(host);
  host.appendChild(h('div', { class: cls ? `rn-yomu ${cls}` : 'rn-yomu' }, [
    h('div', { class: 'rn-yomu-slot' }, [frame, dead]),
    h('div', { class: 'rn-deck-bar' }, [status, open]),
    warn,
  ]));

  const say = (text) => { status.textContent = text; };
  const shout = (text) => { warn.textContent = text; warn.hidden = false; };
  const hush = () => { warn.textContent = ''; warn.hidden = true; };

  function post(message) {
    try {
      frame.contentWindow?.postMessage({ v: PROTOCOL_VERSION, ...message }, origin);
      return true;
    } catch (e) {
      console.error(`[runcible] could not post ${message.type} to Yomu`, e);
      return false;
    }
  }

  function sendText() {
    if (!ready || !want || sent === want) return;
    if (post({ type: 'yomu:load', text: want })) {
      sent = want;
      say(s('reading'));
    }
  }

  // The frame and the silence notice share one slot, so a dead frame is
  // replaced by the way out rather than left as an empty box above it.
  // The status line stays in the tree while the notice shows, because it is the
  // live region that announced the silence, but it is not drawn a second time
  // under a notice that already says so.
  function showDead(on) {
    frame.hidden = on;
    dead.hidden = !on;
    open.hidden = on;
    status.classList.toggle('sr-only', on);
  }

  function onMessage(e) {
    if (!acceptable(e, origin, frame.contentWindow)) return;
    const m = e.data;
    if (!heard) {
      heard = true;
      showDead(false);
    }
    if (m.type === 'yomu:ready') {
      ready = true;
      say(s('ready'));
      // A frame boots in the language its URL named; the page may have
      // switched since, and a reloaded frame has forgotten a yomu:lang.
      if (wantLang !== urlLang) post({ type: 'yomu:lang', lang: wantLang });
      sendText();
      return;
    }
    if (m.type === 'yomu:height' && Number.isFinite(m.height)) {
      const next = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(m.height)));
      if (Math.abs(next - lastHeight) < 2) return;
      lastHeight = next;
      frame.style.height = `${next}px`;
      return;
    }
    if (m.type === 'yomu:read') {
      hush();
      const tokens = Number.isFinite(m.tokens) ? m.tokens : '?';
      const unknown = Number.isFinite(m.unknown) ? m.unknown : 0;
      if (tokens === 1) say(s(unknown > 0 ? 'readOneUnknown' : 'readOne'));
      else say(unknown > 0 ? s('readUnknown', { tokens, unknown }) : s('read', { tokens }));
      return;
    }
    if (m.type === 'yomu:error') {
      console.error('[runcible] yomu:error', m.message);
      say(s('error'));
      if (typeof m.message === 'string' && m.message) shout(m.message);
    }
  }

  function onLoad() {
    // Yomu announces yomu:ready at boot, usually before this load event, so
    // the first document may already be ready and sent its text: that is
    // kept, and the hello only asks it to say so again. A document that
    // loaded AGAIN (a reload inside the frame) has been sent nothing, so its
    // state starts over and its reply to the hello resends the text. A frame
    // that failed to load has an opaque origin and this reaches nothing,
    // which the silence timer below is what reports.
    if (loads++ > 0) {
      ready = false;
      sent = null;
    }
    post({ type: 'yomu:hello' });
  }

  window.addEventListener('message', onMessage);
  frame.addEventListener('load', onLoad);

  // An unreachable Yomu, or one that does not list this origin, sends nothing
  // at all, and silence is the one failure the vocabulary cannot report.
  const silence = setTimeout(() => {
    if (heard) return;
    say(s('silent'));
    showDead(true);
  }, SILENCE_MS);

  return {
    /** Read this text. Replaces whatever Yomu shows; sent once Yomu is ready. */
    load(text) {
      const cut = clip(String(text || '').trim());
      want = cut.text;
      const out = standaloneUrl(want);
      open.href = out;
      deadLink.href = out;
      if (cut.clipped) shout(s('clipped', { n: MAX_TEXT }));
      else hush();
      sendText();
    },
    /** Yomu's interface language, when the page's changed under an open frame. */
    setLang(next) {
      if (!next || next === wantLang) return;
      wantLang = next;
      if (ready) post({ type: 'yomu:lang', lang: next });
    },
    destroy() {
      clearTimeout(silence);
      window.removeEventListener('message', onMessage);
      frame.removeEventListener('load', onLoad);
      clear(host);
    },
  };
}
