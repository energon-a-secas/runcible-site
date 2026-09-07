// ── typed ────────────────────────────────────────────────────
// C2.1: a prompt and a text input. Graded.
// Required spec fields: items, prompt, answer. Optional: transform, compare.
//
// transform (C2.4) is a Book capability. The shell ships none and resolves the
// id from the Book's registry, so what arrives here is already a function or
// the load already failed by name.
//
// C12 A16: a transform may carry an optional settle step. The live half runs
// per keystroke and has to leave an unfinished syllable alone, because the
// learner may still be typing it. Submitting is the moment that says it is
// finished, so settle runs once here, on the produced string, before compare.
// A transform without one behaves exactly as it did before.

import { createSession } from '../session.js';
import { questionFrame, advance } from '../ask.js';
import { el, append, button, focus } from '../dom.js';
import { resolveList, pickItems, fieldValue, displayValue, itemIdOf } from '../items.js';
import { explainWrong, explainRight } from '../feedback.js';
import { isCorrect } from '../compare.js';

/**
 * Run a transform's settle step, if it brought one. C12 A16.
 *
 * A settle that throws must not eat the answer: the learner still gets graded
 * on what is in the box, which is what would have happened with no settle at
 * all, and the console says which one failed.
 *
 * @param {function} [transform]
 * @param {string} value
 * @returns {string}
 */
function settleValue(transform, value) {
  if (typeof transform !== 'function' || typeof transform.settle !== 'function') return value;
  try {
    const out = transform.settle(value);
    return typeof out === 'string' ? out : value;
  } catch (err) {
    console.error('[runcible] transform settle threw at submit', err);
    return value;
  }
}

/**
 * Ask one typed question.
 * @param {object} session
 * @param {object} spec
 * @param {object} q { itemId, expected, expectedLabel, renderPrompt, transform } plus,
 *   when the caller can supply them, the fields the explanation panel reads:
 *   spec, ctx, api, item, expectedRaw, pool, promptField, answerField, promptValue
 * @returns {Promise<void>}
 */
export function askTyped(session, spec, q) {
  const frame = questionFrame(session);
  if (typeof q.renderPrompt === 'function') q.renderPrompt(frame.promptEl);

  const input = el('input', {
    type: 'text',
    class: 'rx-input',
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    'aria-label': session.s('yourAnswer'),
  });
  const form = el('form', { class: 'rx-form toolbar' });
  const submit = el('button', { type: 'submit', class: 'btn btn--primary', text: session.s('check') });
  append(form, [input, submit]);

  const canHint = q.expectedLabel.length > 1 && spec.hint !== false;
  let hintUsed = false;
  const hint = canHint
    ? button(session.s('hint'), () => {
      hintUsed = true;
      hint.disabled = true;
      session.say(session.s('startsWith', { first: Array.from(q.expectedLabel)[0] }));
      focus(input);
    }, { class: 'btn btn--ghost rx-hint' })
    : null;
  if (hint) form.appendChild(hint);

  append(frame.bodyEl, form);

  if (typeof q.transform === 'function') {
    input.addEventListener('input', () => {
      const raw = input.value;
      let out;
      try { out = q.transform(raw); } catch (err) {
        console.error('[runcible] transform threw on input', err);
        return;
      }
      if (typeof out === 'string' && out !== raw) input.value = out;
    });
  }

  const started = performance.now();

  return new Promise((resolve) => {
    let answered = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (answered) return;
      const box = input.value;
      if (box.trim() === '') { focus(input); return; }
      answered = true;
      const ms = performance.now() - started;
      const produced = settleValue(q.transform, box);
      // Show what is being graded. A learner who typed shinbun and sees the
      // box settle to しんぶん can see why it was marked the way it was.
      if (produced !== box) input.value = produced;
      const correct = isCorrect(produced, q.expected, spec.compare);
      input.readOnly = true;
      submit.disabled = true;
      if (hint) hint.disabled = true;
      input.dataset.state = correct ? 'correct' : 'wrong';
      session.record({
        itemId: q.itemId,
        correct,
        ms,
        answer: produced,
        expected: q.expectedLabel,
        hintUsed,
      });
      session.say(
        correct ? session.s('correct') : session.s('notQuite'),
        correct ? 'correct' : 'wrong',
      );
      if (correct) explainRight(session, q);
      else explainWrong(session, Object.assign({ spec }, q, { chosen: produced, expected: q.expectedLabel }));
      await advance(session);
      resolve();
    });
    focus(input);
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
      const expected = fieldValue(item, spec.answer);
      const cue = displayValue(fieldValue(item, spec.prompt));
      await askTyped(session, spec, {
        itemId: itemIdOf(item, spec, spec.prompt, i),
        expected,
        expectedLabel: displayValue(expected),
        expectedRaw: expected,
        transform: spec.transformFn,
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

  return { destroy() { alive = false; session.destroy(); } };
}
