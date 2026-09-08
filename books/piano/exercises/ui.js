// Shared helpers for this Book's own exercise modules.
//
// A Book module owns its host element entirely (C2.2) and receives only the
// frozen api, so it cannot reach the engine's DOM helpers. The Japanese Book
// keeps its own copy of this file for the same reason: the two Books share no
// code, on purpose, because a helper shared between Books is the first step
// towards a shell that knows a subject.
//
// Nothing here ever assigns innerHTML and no listener is ever an attribute.
// C3.3 forbids inline HTML in content and the project forbids inline handlers
// anywhere, so the safe path is the only path on offer.
//
// No string a learner reads is written here either. Every one of them is a
// key in ./strings.js, resolved through the api.t the shell handed the module,
// which is why frame() takes that resolver and hangs it on the view: the
// verdict and the score line are drawn long after the module that owns the api
// has returned.

import { say } from './strings.js';

const DIRECT = new Set(['value', 'checked', 'disabled', 'hidden']);

/** Build an element. `text` sets textContent, everything else is an attribute. */
export function el(tag, props, children) {
  const node = document.createElement(tag);
  const p = props || {};
  for (const key of Object.keys(p)) {
    const v = p[key];
    if (v === null || v === undefined || v === false) continue;
    if (key === 'class') node.className = v;
    else if (key === 'text') node.textContent = String(v);
    else if (key === 'dataset') Object.assign(node.dataset, v);
    else if (DIRECT.has(key)) node[key] = v;
    else node.setAttribute(key, v === true ? '' : String(v));
  }
  if (children !== undefined) add(node, children);
  return node;
}

/** Append a node, a string, or a nested array of either. Nulls are skipped. */
export function add(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) add(parent, c);
    else if (typeof c === 'string' || typeof c === 'number') parent.appendChild(document.createTextNode(String(c)));
    else parent.appendChild(c);
  }
  return parent;
}

/** Remove every child. */
export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** A button whose handler is an argument, never a string in an attribute. */
export function button(label, onClick, cls = 'btn btn--secondary btn--sm', props) {
  const node = el('button', Object.assign({ type: 'button', class: cls, text: label }, props || {}));
  if (typeof onClick === 'function') node.addEventListener('click', onClick);
  return node;
}

/** Fisher-Yates on a copy. */
export function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}

/**
 * Choose the items for one run. With no count every item is asked, which is
 * honest: a silent default would quietly drop most of a long list.
 */
export function pick(items, count) {
  if (!Number.isFinite(count) || count <= 0 || count >= items.length) return shuffle(items);
  return shuffle(items).slice(0, Math.floor(count));
}

/**
 * Resolve a spec field that is either a C3.2 pointer or an inline array.
 * The Book never parses a pointer: C3.2 puts that resolver in the shell and
 * api.data takes the whole string.
 */
export async function resolveList(api, source, field) {
  if (Array.isArray(source)) return source;
  if (typeof source === 'string' && source) {
    const got = await api.data(source);
    if (Array.isArray(got)) return got;
    if (got && typeof got === 'object') return Object.values(got);
    throw new Error(`"${field}" resolved "${source}" to something that is not a list`);
  }
  throw new Error(`"${field}" must be a data pointer string or an array`);
}

/**
 * The frame every module in this Book draws into. `t` is api.t, kept on the
 * view so that everything drawn later can be drawn in the reader's language.
 */
export function frame(host, { t, title, lead, cls = '' }) {
  clear(host);
  const status = el('p', { class: 'pf-status', role: 'status', 'aria-live': 'polite' });
  const body = el('div', { class: 'pf-body' });
  const foot = el('div', { class: 'toolbar pf-foot' });
  const root = el('section', { class: `pf ${cls}`.trim() }, [
    title ? el('h4', { class: 'pf-title', text: title }) : null,
    lead ? el('p', { class: 'pf-lead', text: lead }) : null,
    status,
    body,
    foot,
  ]);
  host.appendChild(root);
  return { root, status, body, foot, t };
}

/**
 * One multiple-choice question over a drawn prompt.
 *
 * The prompt is a node the caller drew, never a string, which is the whole
 * reason these two exercises are modules rather than a generic `choice`.
 *
 * `onAnswer(correct, ms)` fires the moment an option is clicked, and the
 * promise resolves later, when the learner presses Next. Those are two
 * different moments and the attempt belongs to the first one: a learner who
 * answers and then closes the drill has answered, and an attempt recorded on
 * Next would lose it. The promise is only the flow.
 */
export function askDrawn(view, { prompt, options, expected, after, onAnswer }) {
  clear(view.body);
  clear(view.foot);
  add(view.body, prompt);
  const started = performance.now();
  return new Promise((resolve) => {
    let answered = false;
    const row = el('div', { class: 'pf-options' });
    const verdict = el('p', { class: 'pf-verdict', role: 'status', 'aria-live': 'polite' });
    const buttons = options.map((label) => button(label, () => {
      if (answered) return;
      answered = true;
      const correct = label === expected;
      if (onAnswer) onAnswer(correct, Math.round(performance.now() - started), label);
      for (const b of buttons) {
        b.disabled = true;
        if (b.textContent === expected) b.dataset.state = 'correct';
      }
      if (!correct) {
        const chosen = buttons.find((b) => b.textContent === label);
        if (chosen) chosen.dataset.state = 'wrong';
      }
      verdict.textContent = correct
        ? say(view.t, 'correct')
        : say(view.t, 'notThatOne', { expected });
      if (after) add(view.body, el('p', { class: 'pf-note', text: after }));
      const go = button(say(view.t, 'next'), () => resolve(correct), 'btn btn--primary');
      add(view.foot, go);
      go.focus();
    }, 'btn btn--secondary'));
    add(row, buttons);
    add(view.body, [row, verdict]);
    if (buttons[0]) buttons[0].focus();
  });
}

/**
 * The end panel. A button rather than an automatic exit, so the learner reads
 * the result before the page moves.
 */
export function summary(view, api, { asked, right, note = null }) {
  clear(view.body);
  clear(view.foot);
  view.status.textContent = '';
  add(view.body, [
    el('p', { class: 'pf-score', text: say(view.t, 'score', { right, asked }) }),
    note ? el('p', { class: 'pf-note', text: note }) : null,
  ]);
  const go = button(say(view.t, 'continue'), () => api.done({ asked, right, graded: true }), 'btn btn--primary');
  view.foot.appendChild(go);
  go.focus();
}
