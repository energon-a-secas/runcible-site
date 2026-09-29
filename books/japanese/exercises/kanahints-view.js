// Drawing for jp.kanahints: its strings, the frame, the learn card, the stroke
// figure, the option rows and the hint that follows a miss. It registers
// nothing and the shell never imports it; kanahints.js is its one reader.
//
// The frame wears the engine's own rx- classes (css/exercises.css), so a hint
// round looks like every other drill on the page. Two classes were added to
// that file for it, both named for no subject: .rx-picture, an emoji at
// display size, and .rx-glyph, one character at display size that can fade in
// (data-reveal). A Book cannot ship CSS, and a shape learned at the prompt's
// 1.5rem is a shape half seen. .rx-option--glyph sets a one-character option
// at the size the eye can compare two look-alikes in.
//
// Content reaches the page as text nodes only: ui.js has no innerHTML path.

import { el, add, clear } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';

/** KanjiVG's own box. The stroke data is drawn in it as it ships. */
const BOX = 109;

/** How long the picture is alone before the character fades in. */
export const REVEAL_MS = 700;

// Every string a learner reads, in both languages, through api.t.
export const T = {
  title: { en: 'Learn this row with pictures', es: 'Aprende esta fila con imágenes' },
  lead: {
    en: 'A picture and a word for each kana, then a short check. Only the check is recorded, and a hint comes back only after a miss.',
    es: 'Una imagen y una palabra para cada kana, y luego un repaso corto. Solo el repaso queda registrado, y la pista vuelve solo después de un error.',
  },
  rowOf: { en: 'Row {r} of {n}', es: 'Fila {r} de {n}' },
  learnAt: { en: 'Learn {i} of {n}', es: 'Aprender: {i} de {n}' },
  checkAt: { en: 'Check {i} of {n}', es: 'Repaso: {i} de {n}' },
  said: { en: 'said {romaji}', es: 'se dice {romaji}' },
  hear: { en: 'Hear it', es: 'Escúchalo' },
  next: { en: 'Next', es: 'Siguiente' },
  toCheck: { en: 'Check this row', es: 'Repasar esta fila' },
  skipLearn: { en: 'Skip to the check', es: 'Ir al repaso' },
  noVoice: {
    en: 'This device has no Japanese voice, so there is no audio here and no listening question.',
    es: 'Este dispositivo no tiene voz en japonés, así que aquí no hay audio ni preguntas para escuchar.',
  },
  voiceFailed: { en: 'The Japanese voice did not answer.', es: 'La voz en japonés no respondió.' },
  strokes: { en: 'Stroke order for {glyph}, {n} strokes', es: 'Orden de trazos de {glyph}, {n} trazos' },
  strokesOne: { en: 'Stroke order for {glyph}, 1 stroke', es: 'Orden de trazos de {glyph}, 1 trazo' },
  noStrokes: { en: 'The stroke order could not be loaded.', es: 'No se pudo cargar el orden de trazos.' },
  lookalike: { en: 'Look-alike: {tell}', es: 'Se parece: {tell}' },
  qKana: { en: 'What does this say?', es: '¿Qué dice aquí?' },
  qRomaji: { en: 'Which kana says this?', es: '¿Qué kana dice esto?' },
  qSound: { en: 'Listen, then pick the kana you heard.', es: 'Escucha y elige el kana que oíste.' },
  qLookalike: { en: 'They look alike. Which one says this?', es: 'Se parecen. ¿Cuál dice esto?' },
  play: { en: 'Play again', es: 'Otra vez' },
  right: { en: 'Right.', es: 'Correcto.' },
  wrong: { en: 'Not that one. This is {glyph}, {romaji}.', es: 'Ese no. Este es {glyph}, {romaji}.' },
  picked: { en: 'You picked {glyph}. {tell}', es: 'Elegiste {glyph}. {tell}' },
  soundSkipped: {
    en: 'No Japanese voice answered, so this question was skipped and nothing was recorded.',
    es: 'No respondió ninguna voz en japonés, así que esta pregunta se saltó y no se registró nada.',
  },
  keyHint: { en: 'Press 1 to {n}, or use the arrow keys.', es: 'Pulsa del 1 al {n}, o usa las flechas.' },
  rowScore: { en: 'This row: {right} of {asked} right.', es: 'Esta fila: {right} de {asked} correctas.' },
  nextRow: { en: 'Next row', es: 'Siguiente fila' },
  stopHere: { en: 'Stop here', es: 'Terminar aquí' },
  finish: { en: 'See the result', es: 'Ver el resultado' },
  score: { en: '{right} of {asked} right.', es: '{right} de {asked} correctas.' },
  none: { en: 'Nothing was checked, so nothing was recorded.', es: 'No se repasó nada, así que no se registró nada.' },
  go: { en: 'Continue', es: 'Continuar' },
  loadError: { en: 'The hints could not be loaded: {msg}', es: 'No se pudieron cargar las pistas: {msg}' },
  unknownRow: { en: 'this exercise names a row the kana table does not have: {row}', es: 'este ejercicio nombra una fila que la tabla de kana no tiene: {row}' },
  noSkill: { en: 'this exercise has no skill, so a check could not be recorded', es: 'este ejercicio no tiene habilidad, así que no se podría registrar el repaso' },
  skip: { en: 'Skip this exercise', es: 'Saltar este ejercicio' },
};

/** Resolve one {en, es} entry and fill its {placeholders}. */
export function say(api, entry, vars) {
  return String(api.t(entry) || '').replace(/\{(\w+)\}/g, (whole, key) => (
    vars && vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : whole));
}

/** The learner's motion preference, from the shell's attribute or the system. */
export function reducedMotion() {
  const root = document.documentElement;
  return root.hasAttribute('data-reduce-motion')
    || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Can this device speak Japanese. getVoices() is empty on Chrome until
 * voiceschanged fires, and a device with no voices never fires it, so the
 * answer waits for the event with a deadline rather than trusting one read.
 * A Book module cannot import the engine's own probe, and this is the same
 * question asked of the same API.
 */
export function japaneseVoice() {
  const synth = globalThis.speechSynthesis;
  if (!synth || typeof globalThis.SpeechSynthesisUtterance !== 'function') return Promise.resolve(false);
  const has = () => (synth.getVoices() || []).some((v) => /^ja(\b|[-_])/i.test(String(v.lang || '')));
  if ((synth.getVoices() || []).length) return Promise.resolve(has());
  return new Promise((resolve) => {
    let timer = 0;
    const settle = () => {
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', settle);
      resolve(has());
    };
    synth.addEventListener('voiceschanged', settle);
    timer = setTimeout(settle, 1500);
  });
}

/** The frame in the engine's dress: a head, a stage, one live region, a foot. */
export function frame(host, title) {
  clear(host);
  const progress = el('p', { class: 'rx-progress' });
  const stage = el('div', { class: 'rx-stage stack stack--tight' });
  const verdict = el('p', { class: 'rx-verdict' });
  const feedback = el('div', {
    class: 'rx-feedback', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false',
  }, [verdict]);
  const foot = el('footer', { class: 'rx-foot toolbar' });
  const root = el('section', { class: 'rx rx--custom', dataset: { type: 'custom' } }, [
    el('header', { class: 'rx-head' }, [el('h4', { class: 'rx-title section__title', text: title }), progress]),
    stage,
    feedback,
    foot,
  ]);
  host.appendChild(root);
  return { root, progress, stage, feedback, verdict, foot };
}

/**
 * Say something in the live region, dropping whatever hint followed the last
 * answer. quiet keeps it for a screen reader only, for a line the stage
 * already shows in large type.
 */
export function speakOut(view, text, tone, quiet) {
  view.verdict.textContent = text || '';
  view.verdict.classList.toggle('sr-only', !!quiet);
  view.feedback.dataset.tone = tone || '';
  for (const old of view.feedback.querySelectorAll('.rx-explain')) old.remove();
}

function svgEl(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [key, v] of Object.entries(attrs || {})) {
    if (v !== null && v !== undefined) node.setAttribute(key, String(v));
  }
  return node;
}

/** The strokes as KanjiVG draws them, with a numbered start on each. */
export function strokeFigure(api, entry) {
  const data = entry.strokes;
  if (!data) return el('p', { class: 'rx-note', text: api.t(T.noStrokes) });
  const n = data.s.length;
  const svg = svgEl('svg', {
    viewBox: `0 0 ${BOX} ${BOX}`,
    width: 128,
    height: 128,
    role: 'img',
    'aria-label': say(api, n === 1 ? T.strokesOne : T.strokes, { glyph: entry.glyph, n }),
  });
  for (const d of data.s) {
    svg.appendChild(svgEl('path', {
      d, fill: 'none', stroke: 'currentColor', 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
  }
  data.s.forEach((d, i) => {
    const spot = Array.isArray(data.at) ? data.at[i] : null;
    const x = spot ? spot[0] : 6;
    const y = spot ? spot[1] : 6 + (i * 9);
    svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 5.4, fill: 'var(--surface-2)', stroke: 'var(--accent)', 'stroke-width': 0.8 }));
    const label = svgEl('text', { x, y: y + 2.6, 'text-anchor': 'middle', 'font-size': 7, fill: 'var(--text-primary)' });
    label.textContent = String(i + 1);
    svg.appendChild(label);
  });
  return el('figure', { class: 'rx-figure' }, [svg]);
}

/** A romaji as the learner reads it: the particle shows both spellings. */
export function romajiLabel(entry) {
  const others = entry.accept.filter((a) => a !== entry.romaji);
  return others.length ? `${entry.romaji} (${others.join(', ')})` : entry.romaji;
}

/** The glyph at display size. It starts hidden only when it is going to fade in. */
export function glyphNode(glyph, hidden) {
  return el('span', { class: 'rx-glyph', lang: 'ja', text: glyph, dataset: { reveal: hidden ? 'hidden' : 'shown' } });
}

/** The look-alike lines of a hint, one sentence each. */
function contrastLines(api, entry) {
  const list = entry.hint && Array.isArray(entry.hint.contrast) ? entry.hint.contrast : [];
  return list.map((c) => el('p', { class: 'rx-note', text: say(api, T.lookalike, { tell: api.t(c.tell) }) }));
}

/**
 * The learn card: the keyword's picture first, then the character fading in
 * beside it, the story, the strokes and the look-alikes. Returns the glyph so
 * the caller owns the timer that reveals it.
 */
export function learnCard(api, entry, { reveal, lead }) {
  const hint = entry.hint || {};
  const glyph = glyphNode(entry.glyph, reveal);
  const card = el('div', { class: 'stack stack--tight' }, [
    lead ? el('p', { class: 'rx-note', text: lead }) : null,
    el('div', { class: 'toolbar' }, [
      hint.emoji ? el('span', { class: 'rx-picture', 'aria-hidden': 'true', text: hint.emoji }) : null,
      glyph,
    ]),
    el('p', { class: 'rx-explain-answer' }, [
      api.t(hint.keyword) || entry.romaji,
      el('span', { class: 'rx-explain-k', text: `  ${say(api, T.said, { romaji: romajiLabel(entry) })}` }),
    ]),
    hint.story ? el('p', { class: 'rx-para', text: api.t(hint.story) }) : null,
    strokeFigure(api, entry),
    contrastLines(api, entry),
  ]);
  return { card, glyph };
}

/**
 * What follows a miss: the target's picture, keyword and story, and when the
 * learner picked one of its named look-alikes, the tell between the two.
 */
export function hintPanel(api, entry, picked) {
  const hint = entry.hint || {};
  const tell = picked && hint.contrast ? hint.contrast.find((c) => c.kana === picked.glyph) : null;
  return el('div', { class: 'rx-explain' }, [
    el('div', { class: 'toolbar' }, [
      hint.emoji ? el('span', { class: 'rx-picture', 'aria-hidden': 'true', text: hint.emoji }) : null,
      glyphNode(entry.glyph, false),
    ]),
    el('p', { class: 'rx-explain-answer', text: `${api.t(hint.keyword) || ''}  ${say(api, T.said, { romaji: romajiLabel(entry) })}`.trim() }),
    hint.story ? el('p', { class: 'rx-explain-why', text: api.t(hint.story) }) : null,
    tell ? el('p', { class: 'rx-explain-why', text: say(api, T.picked, { glyph: picked.glyph, tell: api.t(tell.tell) }) }) : null,
  ]);
}

const MOVE = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/**
 * Option rows in the engine's shape, [keycap] [label]: digits pick, arrows
 * walk. options are { label, glyph, correct }; a glyph option is set in the
 * content language at comparison size. close() drops the keys, disables every
 * row, fills the right one and ticks its cap, and strikes the chosen wrong one.
 */
export function optionRows(api, options, onChoose) {
  const list = el('ul', { class: 'rx-options', role: 'list' });
  const buttons = options.map((opt, i) => {
    const key = String(i + 1);
    const b = el('button', {
      type: 'button',
      class: opt.glyph ? 'btn btn--secondary rx-option rx-option--glyph' : 'btn btn--secondary rx-option',
      'aria-keyshortcuts': key,
      dataset: { correct: String(opt.correct === true) },
    }, [
      el('kbd', { class: 'rx-key', 'aria-hidden': 'true', text: key }),
      ' ',
      el('span', { class: 'rx-option-label', lang: opt.glyph ? 'ja' : null, text: opt.label }),
    ]);
    b.addEventListener('click', () => onChoose(opt, b));
    list.appendChild(el('li', { class: 'rx-option-row' }, [b]));
    return b;
  });
  list.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const open = buttons.filter((x) => !x.disabled);
    if (!open.length || MOVE[e.key] === undefined) return;
    e.preventDefault();
    const at = open.indexOf(document.activeElement);
    open[(Math.max(at, 0) + MOVE[e.key] + open.length) % open.length].focus();
  });
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const hit = buttons.find((x) => x.getAttribute('aria-keyshortcuts') === e.key);
    if (!hit || hit.disabled) return;
    e.preventDefault();
    hit.click();
  };
  document.addEventListener('keydown', onKey);
  const hint = el('p', { class: 'rx-keyhint', text: say(api, T.keyHint, { n: buttons.length }) });
  const release = () => document.removeEventListener('keydown', onKey);
  const close = (chosen) => {
    release();
    hint.hidden = true;
    for (const b of buttons) {
      b.disabled = true;
      if (b.dataset.correct === 'true') {
        b.dataset.state = 'correct';
        const cap = b.querySelector('.rx-key');
        if (cap) cap.textContent = '✓';
      } else if (b === chosen) {
        b.dataset.state = 'wrong';
      }
    }
  };
  return { list, buttons, hint, release, close };
}

/** Append the question's regions to the stage, replacing what was there. */
export function stageWith(view, nodes) {
  clear(view.stage);
  clear(view.foot);
  add(view.stage, nodes);
}
