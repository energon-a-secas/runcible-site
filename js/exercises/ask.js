// ── The question frame ───────────────────────────────────────
// The layout and the keyboard contract shared by every question the engine
// asks. These are keyboard driven drills: the first control of every question
// is focused, Enter always means "go on", and no type needs the pointer.

import { el, append, button, clear, focus } from './dom.js';

/** Lay out one question inside the session stage and return its three regions. */
export function questionFrame(session) {
  clear(session.stage);
  clear(session.foot);
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

/** Digit keys 1 to 9 pick the nth control. Removed as soon as the answer lands. */
export function digitPicker(buttons) {
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const idx = '123456789'.indexOf(e.key);
    if (idx === -1 || !buttons[idx] || buttons[idx].disabled) return;
    e.preventDefault();
    buttons[idx].click();
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
