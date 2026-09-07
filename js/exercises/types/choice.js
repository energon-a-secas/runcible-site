// ── choice ───────────────────────────────────────────────────
// C2.1: a prompt, N options, one correct. Graded.
// Required spec fields: items, prompt, answer, distractors.
//
// askChoice is exported because listen with respond: "choice" is the same
// question with a different prompt (C2.1), and two copies of a grading path is
// two places for the attempt shape to drift.
//
// The option row is `[keycap] [label]`, built by ask.js: the number is an
// element beside the answer, never a prefix inside it. Right and wrong are
// shapes, not two reds: the correct row fills and ticks, the chosen wrong row
// keeps its border and strikes its label. --danger stays for destructive
// actions and never appears in a drill.

import { createSession } from '../session.js';
import { questionFrame, advance, optionList } from '../ask.js';
import { el, append, focus } from '../dom.js';
import { explainWrong, explainRight } from '../feedback.js';
import {
  resolveList, pickItems, fieldValue, displayValue, itemIdOf, distractorsFor, shuffle,
} from '../items.js';

/**
 * Ask one multiple choice question.
 * @param {object} session
 * @param {object} q {
 *   itemId, options: [{label, correct}], expectedLabel, renderPrompt,
 *   and, when the caller can supply them, the fields the explanation reads:
 *   spec, ctx, api, item, expectedRaw, pool, promptField, answerField, promptValue
 * }
 * @returns {Promise<void>}
 */
export function askChoice(session, q) {
  const frame = questionFrame(session);
  if (typeof q.renderPrompt === 'function') q.renderPrompt(frame.promptEl);

  const started = performance.now();

  return new Promise((resolve) => {
    let answered = false;
    let closeOptions = () => {};

    const choose = async (opt, btn) => {
      if (answered) return;
      answered = true;
      const ms = performance.now() - started;
      const correct = opt.correct === true;
      closeOptions();
      btn.dataset.state = correct ? 'correct' : 'wrong';
      session.record({
        itemId: q.itemId,
        correct,
        ms,
        answer: opt.label,
        expected: q.expectedLabel,
        hintUsed: false,
      });
      session.say(
        correct ? session.s('correct') : session.s('notThatOne'),
        correct ? 'correct' : 'wrong',
      );
      if (correct) explainRight(session, q);
      else explainWrong(session, Object.assign({}, q, { chosen: opt.label, expected: q.expectedLabel }));
      await advance(session);
      resolve();
    };

    const { list, buttons, hint, release, close } = optionList(session, q.options, choose);
    append(frame.bodyEl, [list, hint]);
    closeOptions = close;
    session.on(session.root, 'rx-teardown', () => release());
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
      const expectedRaw = fieldValue(item, spec.answer);
      const expected = displayValue(expectedRaw);
      const wrong = distractorsFor(spec, item, pool, spec.answer, ctx);
      const options = shuffle(
        [{ label: expected, correct: true }].concat(wrong.map((w) => ({ label: w, correct: false }))),
      );
      const cue = displayValue(fieldValue(item, spec.prompt));
      await askChoice(session, {
        itemId: itemIdOf(item, spec, spec.prompt, i),
        options,
        expectedLabel: expected,
        expectedRaw,
        spec,
        ctx,
        api,
        item,
        pool,
        promptField: spec.prompt,
        answerField: spec.answer,
        promptValue: cue,
        renderPrompt: (target) => {
          target.appendChild(el('p', { class: 'rx-cue', text: cue, dataset: cue.length > 24 ? { long: '' } : {} }));
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
