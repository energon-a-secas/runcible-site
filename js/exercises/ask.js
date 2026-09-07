// ── The question frame ───────────────────────────────────────
// The layout and the keyboard contract shared by every question the engine
// asks. These are keyboard driven drills: the first control of every question
// is focused, Enter always means "go on", and no type needs the pointer.
//
// Options are rows of `[keycap] [label]`, and the keycap is a real element
// beside the label, never a prefix inside it. A prefix reads as part of the
// answer, which is exactly what "1. 5  2. 4  3. 6" did to the beats drill: the
// numbers looked like the thing being asked about.
//
// When every option is itself a bare integer the keycap would be a second
// number beside a number, so it is dropped and the label becomes the key: the
// row is a square tile showing 5, and pressing 5 picks it. Two digit labels
// cannot be one keypress, so those keep the tiles and lose the shortcut rather
// than mapping "1" to "12".

import { el, append, button, clear, focus } from './dom.js';

// In numeral mode the label is the key, so a single digit is enough and zero
// is as pressable as any other. The 1..9 cap beside a label is a different
// question, answered by the option's position (i < 9).
const ONE_KEYPRESS = /^[0-9]$/;
const BARE_INTEGER = /^\d{1,4}$/;
const MOVE = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/** Lay out one question inside the session stage and return its three regions. */
export function questionFrame(session) {
  clear(session.stage);
  clear(session.foot);
  // The verdict of the previous question is not the verdict of this one.
  session.say('');
  const promptEl = el('div', { class: 'rx-prompt' });
  const bodyEl = el('div', { class: 'rx-body stack stack--tight' });
  const afterEl = el('div', { class: 'rx-after' });
  append(session.stage, [promptEl, bodyEl, afterEl]);
  return { promptEl, bodyEl, afterEl };
}

/**
 * Show the control that ends the current question and resolve when it is used.
 * Enter also advances, so a whole exercise runs from the keyboard without ever
 * reaching for Tab.
 * @returns {Promise<void>}
 */
export function advance(session, label) {
  return new Promise((resolve) => {
    const go = () => {
      document.removeEventListener('keydown', onKey, true);
      resolve();
    };
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.defaultPrevented) return;
      // Enter on some other control is that control's own key.
      const t = e.target;
      if (t && t !== next && t.closest && t.closest('button, a, input, select, textarea, [role="button"]')) return;
      e.preventDefault();
      go();
    };
    const next = button(label || session.s('next'), go, { class: 'btn btn--primary rx-next' });
    session.foot.appendChild(next);
    session.on(document, 'keydown', onKey, true);
    focus(next);
  });
}

/**
 * Build the option list for a question.
 *
 * @param {object} session
 * @param {Array<{label: string, correct?: boolean}>} options
 * @param {(opt: object, btn: HTMLElement) => void} onChoose
 * @returns {{ list, buttons, hint, release, close }} `close()` ends the
 *   question: it drops the digit shortcut, disables every row, ticks the
 *   correct keycap and takes the keyboard hint away, because a hint about keys
 *   that no longer do anything is furniture.
 */
export function optionList(session, options, onChoose) {
  const numeral = options.length > 0 && options.every((o) => BARE_INTEGER.test(String(o.label)));
  const shortcut = numeral
    ? options.every((o) => ONE_KEYPRESS.test(String(o.label)))
    : options.length <= 9;

  const list = el('ul', {
    class: numeral ? 'rx-options rx-options--numeral' : 'rx-options',
    role: 'list',
  });
  const buttons = [];

  options.forEach((opt, i) => {
    const label = String(opt.label);
    const key = numeral ? label : String(i + 1);
    const cap = el('kbd', {
      class: numeral ? 'rx-key rx-key--label' : 'rx-key',
      // In numeral mode the cap IS the label, so it must stay in the
      // accessible name. Beside a label it is decoration for the eye and the
      // shortcut is announced by aria-keyshortcuts instead.
      'aria-hidden': numeral ? null : 'true',
      text: numeral || i < 9 ? key : '',
    });
    const body = numeral ? null : el('span', { class: 'rx-option-label', text: label });
    // A space between the two, so the row reads "1 a" and not "1a" to find in
    // page, to a copy, and to anything that reads textContent. The visible gap
    // between them is a CSS gap, which none of those can see.
    const b = button([cap, body ? ' ' : null, body], () => onChoose(opt, b), {
      class: numeral ? 'btn btn--secondary rx-option rx-option--numeral' : 'btn btn--secondary rx-option',
    });
    if (shortcut && (numeral || i < 9)) b.setAttribute('aria-keyshortcuts', key);
    b.dataset.correct = String(opt.correct === true);
    buttons.push(b);
    list.appendChild(el('li', { class: 'rx-option-row' }, [b]));
  });

  list.addEventListener('keydown', (e) => roving(e, buttons));

  const hintKey = !shortcut ? 'keyHintArrows' : numeral ? 'keyHintNumeral' : 'keyHint';
  const hint = el('p', { class: 'rx-keyhint', text: session.s(hintKey) });
  const release = shortcut ? digitPicker(buttons) : () => {};

  const close = () => {
    release();
    hint.hidden = true;
    for (const b of buttons) {
      b.disabled = true;
      if (b.dataset.correct !== 'true') continue;
      b.dataset.state = 'correct';
      const cap = b.querySelector('.rx-key');
      // Only a decorative cap may become a tick. In numeral mode the cap is
      // the answer, and replacing it would delete what the row is saying.
      if (cap && cap.getAttribute('aria-hidden') === 'true') cap.textContent = '✓';
    }
  };

  return { list, buttons, hint, release, close };
}

/** Arrow keys walk the enabled controls of a list; Home and End jump. */
export function roving(e, buttons) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
  const open = buttons.filter((b) => !b.disabled);
  if (open.length === 0) return;
  const at = open.indexOf(document.activeElement);
  let next = null;
  if (MOVE[e.key] !== undefined) {
    next = open[(Math.max(at, 0) + MOVE[e.key] + open.length) % open.length];
  } else if (e.key === 'Home') next = open[0];
  else if (e.key === 'End') next = open[open.length - 1];
  if (!next) return;
  e.preventDefault();
  focus(next);
}

/**
 * Digit keys pick the control that claims them through aria-keyshortcuts, so
 * the key a row shows is the key that presses it. Removed as soon as the
 * answer lands.
 */
export function digitPicker(buttons) {
  const byKey = new Map();
  for (const b of buttons) {
    const k = b.getAttribute('aria-keyshortcuts');
    if (k && !byKey.has(k)) byKey.set(k, b);
  }
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const hit = byKey.get(e.key);
    if (!hit || hit.disabled) return;
    e.preventDefault();
    hit.click();
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
