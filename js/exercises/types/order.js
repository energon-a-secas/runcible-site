// ── order ────────────────────────────────────────────────────
// C2.1: shuffled tokens, arrange them. Graded.
// Required spec fields: items, sequence.
//
// spec.sequence names the field holding the correct order for one item: an
// array of tokens, or a string that is split on whitespace. One attempt per
// item, graded on the whole arrangement, because half a sentence in the right
// order is not half an answer.

import { createSession } from '../session.js';
import { questionFrame, advance } from '../ask.js';
import { el, append, button, clear, focus } from '../dom.js';
import { resolveList, pickItems, fieldValue, displayValue, itemIdOf, shuffle } from '../items.js';
import { parseCompare, normalise } from '../compare.js';

function tokensOf(value) {
  if (Array.isArray(value)) return value.map(displayValue).filter((t) => t !== '');
  const s = displayValue(value).trim();
  return s === '' ? [] : s.split(/\s+/);
}

function askOrder(session, spec, q) {
  const frame = questionFrame(session);
  if (typeof q.renderPrompt === 'function') q.renderPrompt(frame.promptEl);

  const line = el('div', { class: 'rx-line', role: 'list', 'aria-label': session.s('yourArrangement') });
  const bank = el('div', { class: 'rx-bank', role: 'list', 'aria-label': session.s('tokens') });
  append(frame.bodyEl, [line, bank]);

  const placed = [];
  const pool = shuffle(q.tokens.map((text, i) => ({ id: `t${i}`, text })));
  let hintUsed = false;
  const started = performance.now();

  const check = el('button', { type: 'button', class: 'btn btn--primary', text: session.s('check') });
  const hint = q.tokens.length > 1 && spec.hint !== false
    ? button(session.s('hint'), () => {
      hintUsed = true;
      hint.disabled = true;
      session.say(session.s('startsWith', { first: q.tokens[0] }));
    }, { class: 'btn btn--ghost' })
    : null;

  function draw() {
    clear(line);
    clear(bank);
    if (placed.length === 0) {
      line.appendChild(el('span', { class: 'rx-line-empty', text: session.s('nothingPlaced') }));
    }
    placed.forEach((tok) => {
      const b = button(tok.text, () => {
        const i = placed.indexOf(tok);
        if (i !== -1) placed.splice(i, 1);
        draw();
      }, { class: 'btn btn--secondary rx-token rx-token--placed', 'aria-label': session.s('removeToken', { token: tok.text }) });
      line.appendChild(b);
    });
    const left = pool.filter((t) => !placed.includes(t));
    left.forEach((tok) => {
      const b = button(tok.text, () => { placed.push(tok); draw(); }, {
        class: 'btn btn--ghost rx-token', 'aria-label': session.s('placeToken', { token: tok.text }),
      });
      bank.appendChild(b);
    });
    check.disabled = placed.length === 0;
    const focusTarget = bank.querySelector('button') || line.querySelector('button') || check;
    focus(focusTarget);
  }

  session.foot.appendChild(check);
  if (hint) session.foot.appendChild(hint);
  draw();

  return new Promise((resolve) => {
    let answered = false;
    const onKey = (e) => {
      if (answered) return;
      if (e.key === 'Backspace') {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        if (placed.length === 0) return;
        e.preventDefault();
        placed.pop();
        draw();
      }
    };
    session.on(document, 'keydown', onKey);

    check.addEventListener('click', async () => {
      if (answered) return;
      answered = true;
      document.removeEventListener('keydown', onKey);
      const ms = performance.now() - started;
      const { tokens: folds } = parseCompare(spec.compare);
      const produced = placed.map((t) => t.text);
      const correct = produced.length === q.tokens.length
        && produced.every((t, i) => normalise(t, folds) === normalise(q.tokens[i], folds));
      check.disabled = true;
      if (hint) hint.disabled = true;
      for (const b of line.querySelectorAll('button')) b.disabled = true;
      for (const b of bank.querySelectorAll('button')) b.disabled = true;
      line.dataset.state = correct ? 'correct' : 'wrong';
      session.record({
        itemId: q.itemId,
        correct,
        ms,
        answer: produced.join(' '),
        expected: q.tokens.join(' '),
        hintUsed,
      });
      session.say(correct ? session.s('correct') : session.s('notThatOrder', { answer: q.tokens.join(' ') }));
      await advance(session);
      resolve();
    });
  });
}

export function mount(host, spec, api, ctx) {
  const session = createSession(host, spec, api, ctx);
  let alive = true;

  (async () => {
    const pool = await resolveList(spec.items, api, ctx, spec, 'items');
    const chosen = pickItems(pool, spec.count);
    session.setTotal(chosen.length);

    for (let i = 0; i < chosen.length && alive; i++) {
      session.step();
      const item = chosen[i];
      const tokens = tokensOf(fieldValue(item, spec.sequence));
      if (tokens.length < 2) continue;
      const cue = spec.prompt ? displayValue(fieldValue(item, spec.prompt)) : '';
      await askOrder(session, spec, {
        itemId: itemIdOf(item, spec, spec.prompt || spec.sequence, i),
        tokens,
        renderPrompt: (target) => {
          if (cue) target.appendChild(el('p', { class: 'rx-cue', text: cue }));
        },
      });
    }
    if (alive) session.finish();
  })().catch((err) => { if (alive) session.fail(err); });

  return { destroy() { alive = false; session.destroy(); } };
}
