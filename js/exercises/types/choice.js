// ── choice ───────────────────────────────────────────────────
// C2.1: a prompt, N options, one correct. Graded.
// Required spec fields: items, prompt, answer, distractors.
//
// askChoice is exported because listen with respond: "choice" is the same
// question with a different prompt (C2.1), and two copies of a grading path is
// two places for the attempt shape to drift.

import { createSession } from '../session.js';
import { questionFrame, advance, digitPicker } from '../ask.js';
import { el, append, button, focus } from '../dom.js';
import {
  resolveList, pickItems, fieldValue, displayValue, itemIdOf, distractorsFor, shuffle,
} from '../items.js';

/**
 * Ask one multiple choice question.
 * @param {object} session
 * @param {object} q { itemId, options: [{label, correct}], expectedLabel, renderPrompt }
 * @returns {Promise<void>}
 */
export function askChoice(session, q) {
  const frame = questionFrame(session);
  if (typeof q.renderPrompt === 'function') q.renderPrompt(frame.promptEl);

  const list = el('ul', { class: 'rx-options', role: 'list' });
  const buttons = [];
  const started = performance.now();

  return new Promise((resolve) => {
    let answered = false;
    let releaseDigits = () => {};

    const choose = async (opt, btn) => {
      if (answered) return;
      answered = true;
      releaseDigits();
      const ms = performance.now() - started;
      const correct = opt.correct === true;
      for (const b of buttons) {
        b.disabled = true;
        if (b.dataset.correct === 'true') b.dataset.state = 'correct';
      }
      btn.dataset.state = correct ? 'correct' : 'wrong';
      session.record({
        itemId: q.itemId,
        correct,
        ms,
        answer: opt.label,
        expected: q.expectedLabel,
        hintUsed: false,
      });
      session.say(correct ? session.s('correct') : session.s('notThatOne', { answer: q.expectedLabel }));
      await advance(session);
      resolve();
    };

    q.options.forEach((opt, i) => {
      const b = button(`${i + 1}. ${opt.label}`, () => choose(opt, b), {
        class: 'btn btn--secondary rx-option',
      });
      b.dataset.correct = String(opt.correct === true);
      buttons.push(b);
      list.appendChild(el('li', { class: 'rx-option-row' }, [b]));
    });
    append(frame.bodyEl, list);
    releaseDigits = digitPicker(buttons);
    session.on(session.root, 'rx-teardown', releaseDigits);
    focus(buttons[0]);
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
      const expected = displayValue(fieldValue(item, spec.answer));
      const wrong = distractorsFor(spec, item, pool, spec.answer, ctx);
      const options = shuffle(
        [{ label: expected, correct: true }].concat(wrong.map((w) => ({ label: w, correct: false }))),
      );
      const cue = displayValue(fieldValue(item, spec.prompt));
      await askChoice(session, {
        itemId: itemIdOf(item, spec, spec.prompt, i),
        options,
        expectedLabel: expected,
        renderPrompt: (target) => {
          target.appendChild(el('p', { class: 'rx-cue', text: cue }));
        },
      });
    }
    if (alive) session.finish();
  })().catch((err) => { if (alive) session.fail(err); });

  return {
    destroy() {
      alive = false;
      session.root.dispatchEvent(new Event('rx-teardown'));
      session.destroy();
    },
  };
}
