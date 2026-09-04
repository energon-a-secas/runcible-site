// The { en, es } resolver, plus the shell's own UI copy.
//
// Semantics are copied from projects/gamme-site/js/state.js:37-42 and frozen in
// the CONTRACTS preamble: a bare string is legal, English is the fallback, then
// Spanish, then empty string. Never undefined reaching the DOM.
//
// The honesty rule (gamme state.js:13-14, CONTRACTS convention 2): a page shown
// in Spanish with untranslated content says so once, rather than half
// translating. That is what beginPage() and hadFallback() are for: every t()
// during a render records whether it fell back, and render.js emits one line.

import { state } from './state.js';

export const LANGS = ['en', 'es'];

let _fellBack = false;
const _watchers = new Set();

/** Called by render.js before it builds a view. */
export function beginPage() {
  _fellBack = false;
}

/** True when anything on this page was shown in English to a Spanish reader. */
export function hadFallback() {
  return _fellBack;
}

/**
 * Be told the first time a page falls back after it was painted. An exercise
 * mounts after render() has already emitted its one line, and its strings
 * resolve through this same t(), so without this the honesty line would only
 * ever describe the page as it was before the drill started.
 * @param {() => void} fn
 * @returns {() => void} unsubscribe
 */
export function onFallback(fn) {
  _watchers.add(fn);
  return () => _watchers.delete(fn);
}

function noteFallback() {
  if (_fellBack) return;
  _fellBack = true;
  for (const fn of _watchers) {
    try { fn(); } catch (e) { console.error('[runcible]', e); }
  }
}

/**
 * Resolve a bilingual object to a string.
 * @param {string|{en?:string,es?:string}|null|undefined} obj
 * @param {string} [lang]
 */
export function t(obj, lang = state.prefs.lang) {
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return String(obj);
  const own = obj[lang];
  if (own !== null && own !== undefined && own !== '') return typeof own === 'string' ? own : String(own);
  if (lang !== 'en') noteFallback();
  const en = obj.en;
  if (en !== null && en !== undefined && en !== '') return typeof en === 'string' ? en : String(en);
  const es = obj.es;
  if (es !== null && es !== undefined && es !== '') return typeof es === 'string' ? es : String(es);
  return '';
}

/**
 * Resolve a bilingual value that holds an array (a prose body, table columns).
 * Same fallback order as t().
 * @returns {string[]}
 */
export function tList(obj, lang = state.prefs.lang) {
  if (obj === null || obj === undefined) return [];
  if (Array.isArray(obj)) return obj.map((x) => (typeof x === 'string' ? x : t(x, lang)));
  if (typeof obj === 'string') return [obj];
  if (typeof obj !== 'object') return [String(obj)];
  const own = obj[lang];
  if (Array.isArray(own) && own.length) return own.map(String);
  if (lang !== 'en') noteFallback();
  if (Array.isArray(obj.en) && obj.en.length) return obj.en.map(String);
  if (Array.isArray(obj.es) && obj.es.length) return obj.es.map(String);
  return [];
}

/** The shell's own strings. Book content never appears here. */
const UI = {
  today: { en: 'Today', es: 'Hoy' },
  books: { en: 'Books', es: 'Libros' },
  settings: { en: 'Settings', es: 'Ajustes' },
  nextLesson: { en: 'Next lesson', es: 'Siguiente lección' },
  reviews: { en: 'Reviews due', es: 'Repasos pendientes' },
  game: { en: 'One game', es: 'Un juego' },
  open: { en: 'Open', es: 'Abrir' },
  start: { en: 'Start', es: 'Empezar' },
  openAnyway: { en: 'I already know this, open it anyway', es: 'Ya sé esto, ábrelo igual' },
  relock: { en: 'Lock it again', es: 'Bloquear de nuevo' },
  locked: { en: 'Locked', es: 'Bloqueado' },
  available: { en: 'Open', es: 'Abierto' },
  passed: { en: 'Passed', es: 'Superado' },
  planned: { en: 'Not built yet', es: 'Todavía no existe' },
  opened: { en: 'Opened by you', es: 'Abierto por ti' },
  goal: { en: 'Goal', es: 'Objetivo' },
  unlocks: { en: 'Unlocks', es: 'Desbloquea' },
  evidence: { en: 'Evidence', es: 'Evidencia' },
  chapters: { en: 'Chapters', es: 'Capítulos' },
  track: { en: 'Track', es: 'Ruta' },
  language: { en: 'Language', es: 'Idioma' },
  nothingDue: { en: 'Nothing is due. Start a lesson instead.', es: 'No hay repasos. Empieza una lección.' },
  noGame: { en: 'No drill is unlocked yet.', es: 'Todavía no hay ningún ejercicio abierto.' },
  allPassed: { en: 'Every chapter is passed.', es: 'Todos los capítulos están superados.' },
  untranslated: {
    en: 'Some of this page is only written in English.',
    es: 'Parte de esta página solo está escrita en inglés.',
  },
  overrideNote: {
    en: 'You opened these without the evidence. They are still not passed.',
    es: 'Abriste estos sin la evidencia. Siguen sin estar superados.',
  },
  openInRappel: { en: 'Open in Rappel', es: 'Abrir en Rappel' },
  notSaved: {
    en: 'This frame is not saving progress. Open Rappel to keep it.',
    es: 'Este marco no guarda el progreso. Abre Rappel para conservarlo.',
  },
  back: { en: 'Back', es: 'Volver' },
  loadFailed: { en: 'That did not load', es: 'Eso no se cargó' },
  due: { en: 'due', es: 'pendientes' },
  fresh: { en: 'new', es: 'nuevas' },
  total: { en: 'total', es: 'en total' },
  deckNoSkill: {
    en: 'This deck is not reporting a skill, so these reviews are not counting toward the chapter.',
    es: 'Esta baraja no informa ninguna habilidad, así que estos repasos no cuentan para el capítulo.',
  },
  deckError: { en: 'Rappel reported a problem', es: 'Rappel informó un problema' },
  deckSilent: { en: 'No answer from Rappel', es: 'Rappel no responde' },
  deckSilentDetail: {
    en: 'The review frame did not load. Open in Rappel still works.',
    es: 'El marco de repaso no cargó. Abrir en Rappel sigue funcionando.',
  },
  loading: { en: 'Loading', es: 'Cargando' },
  weak: { en: 'Weakest skills', es: 'Habilidades más débiles' },
  attempts: { en: 'attempts', es: 'intentos' },
  correct: { en: 'correct', es: 'correcto' },
  reset: { en: 'Reset this book', es: 'Reiniciar este libro' },
  oneTrack: { en: 'This Book has one track.', es: 'Este libro tiene una sola ruta.' },
  bookModules: { en: 'Book modules', es: 'Módulos del libro' },
  resetDone: { en: 'Progress cleared', es: 'Progreso borrado' },
  storageOff: {
    en: 'Storage is unavailable, so nothing on this page is being saved.',
    es: 'El almacenamiento no está disponible, nada de esta página se guarda.',
  },
  // The chrome around the view: header nav, the language toggle, the footer.
  // index.html marks each node with data-ui="<key>" and render.js relabels
  // them on every paint, so a language change reaches the shell as well as
  // the page.
  english: { en: 'English', es: 'inglés' },
  spanish: { en: 'Spanish', es: 'español' },
  langNow: { en: 'Language: {lang}. Switch to {other}', es: 'Idioma: {lang}. Cambiar a {other}' },
  skipToContent: { en: 'Skip to content', es: 'Saltar al contenido' },
  footerRead: { en: 'Read', es: 'Leer' },
  footerReview: { en: 'Review', es: 'Repasar' },
  footerTagline: {
    en: 'Runs in your browser. Progress is stored on this device until you sign in.',
    es: 'Funciona en tu navegador. El progreso se guarda en este dispositivo hasta que inicies sesión.',
  },
  authNote: {
    en: 'Sign in to keep your progress on every device. With no account, everything stays in this browser.',
    es: 'Inicia sesión para conservar tu progreso en todos tus dispositivos. Sin cuenta, todo se queda en este navegador.',
  },
  account: { en: 'Account', es: 'Cuenta' },
};

/**
 * Shell UI string by key. {name} placeholders are filled from vars, as text.
 * @param {string} key
 * @param {Object<string, *>} [vars]
 * @param {string} [lang]
 */
export function ui(key, vars, lang = state.prefs.lang) {
  const entry = UI[key];
  if (!entry) return key;
  // Shell copy exists in both languages, so this never records a fallback.
  let out = entry[lang] || entry.en;
  if (vars && typeof vars === 'object') {
    for (const name of Object.keys(vars)) out = out.split(`{${name}}`).join(String(vars[name] ?? ''));
  }
  return out;
}

/**
 * Relabel the shell around the view. index.html marks a node with
 * data-ui="<key>", plus data-ui-attr="<attribute>" when the label is an
 * attribute rather than the text, and the EN / ES toggle is told which
 * language is current: the current code is a <strong>, and the accessible
 * name says what is on and what a press switches to. render.js calls this on
 * every paint, so a language change reaches the header and the footer as well
 * as the page.
 */
export function applyChrome(lang = state.prefs.lang) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll('[data-ui]')) {
    const label = ui(node.dataset.ui, null, lang);
    if (node.dataset.uiAttr) node.setAttribute(node.dataset.uiAttr, label);
    else node.textContent = label;
  }
  const toggle = document.getElementById('langToggle');
  if (!toggle) return;
  const name = (code) => ui(code === 'es' ? 'spanish' : 'english', null, lang);
  const label = ui('langNow', { lang: name(lang), other: name(lang === 'es' ? 'en' : 'es') }, lang);
  toggle.textContent = '';
  LANGS.forEach((code, i) => {
    if (i) toggle.appendChild(document.createTextNode(' / '));
    const on = code === lang;
    const part = document.createElement(on ? 'strong' : 'span');
    part.className = on ? 'rn-lang rn-lang--on' : 'rn-lang';
    part.textContent = code.toUpperCase();
    toggle.appendChild(part);
  });
  toggle.setAttribute('aria-label', label);
  toggle.title = label;
  toggle.dataset.lang = lang;
}
