// ── The session ──────────────────────────────────────────────
// Every generic type except custom renders through here, so the attempt path
// exists once. C2.6: the attempt shape is what unlocking measures, what weak
// item resurfacing queries and what the Rappel bridge writes, and it is already
// on visitors' disks once anything ships. One writer is the only way it stays
// one shape.
//
// api.attempt is called directly and is not wrapped. A throw from the shell's
// recorder is a bug in the recorder, and swallowing it here would turn a
// chapter that silently never unlocks into the hardest class of bug this
// campaign has.

import { el, append, button, clear, focus, listeners } from './dom.js';
import { chrome } from './strings.js';

/**
 * @param {HTMLElement} host the element the exercise owns entirely (C2.2)
 * @param {object} spec
 * @param {object} api the frozen { attempt, t, lang, data, tts, done }
 * @param {object} ctx { bookId, chapterId, rungId }
 * @param {{ progress?: boolean, unit?: string, feedbackAbove?: boolean }} [opts]
 *   progress: false draws no position line
 *   unit: 'question' (default) or 'page', the noun the position line counts
 *   feedbackAbove: put the live region above the stage, for a type whose stage
 *     is a board rather than a running question (match), so the verdict is
 *     never under the board and never under a floating button on a phone
 */
export function createSession(host, spec, api, ctx, opts) {
  const o = opts || {};
  const bound = listeners();
  const t = typeof api.t === 'function' ? api.t : (v) => (typeof v === 'string' ? v : '');
  /** A chrome string (strings.js) in the reader's language, through api.t. */
  const s = (key, vars) => chrome(t, key, vars);

  const root = el('section', {
    class: `rx rx--${spec.type}`,
    dataset: { exercise: spec.id || '', type: spec.type || '' },
  });

  const titleText = t(spec.title);
  // h4, under the rung's h3. The marker in the prose names the exercise as a
  // label rather than a heading (js/render-chapter.js), so this is the one
  // heading the exercise contributes and it sits one level below its rung.
  const heading = el('h4', { class: 'rx-title section__title', text: titleText || '' });
  const progress = el('p', { class: 'rx-progress', text: '' });
  const head = el('header', { class: 'rx-head' }, [titleText ? heading : null, progress]);

  const stage = el('div', { class: 'rx-stage stack stack--tight' });
  // One live region per exercise. The verdict is its first line and the
  // explanation panel is appended after it, so a reader hears "Not that one"
  // and then why, in that order, without a second region competing.
  const verdict = el('p', { class: 'rx-verdict' });
  const feedback = el('div', {
    class: 'rx-feedback', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false',
  }, [verdict]);
  const foot = el('footer', { class: 'rx-foot toolbar' });

  append(root, o.feedbackAbove ? [head, feedback, stage, foot] : [head, stage, feedback, foot]);
  clear(host);
  host.appendChild(root);

  let asked = 0;
  let right = 0;
  let graded = 0;
  let total = 0;
  let manualStep = 0;
  let finished = false;

  function setTotal(n) {
    total = n;
    renderProgress();
  }

  function renderProgress() {
    if (o.progress === false || !total) { progress.textContent = ''; return; }
    const at = manualStep > 0 ? manualStep : Math.min(asked + 1, total);
    progress.textContent = s(o.unit === 'page' ? 'page' : 'question', { at, total });
  }

  /**
   * Advance the counter. Types that ask one item after another let it follow
   * the attempt count; read passes an explicit 1-based page number, because a
   * reader who goes back is on page 2 again and the counter must say so.
   */
  function step(n) {
    manualStep = Number.isFinite(n) ? n : 0;
    renderProgress();
  }

  /**
   * The verdict line. Saying anything drops the explanation panel that
   * belonged to the previous answer: an explanation outliving its question is
   * worse than none, because it looks like it is about the one on screen.
   */
  function say(message, tone) {
    verdict.textContent = message || '';
    feedback.dataset.tone = tone || '';
    for (const old of feedback.querySelectorAll('.rx-explain')) old.remove();
  }

  /** Add the explanation panel under the verdict, inside the same live region. */
  function explain(node) {
    if (!node) return null;
    feedback.appendChild(node);
    return node;
  }

  /**
   * Record one attempt. C2.3, in full and in one place.
   * `correct` may be true, false or null; null means recorded, not graded.
   */
  function record(a) {
    const payload = {
      itemId: a.itemId,
      skill: a.skill || spec.skill,
      correct: a.correct === undefined ? null : a.correct,
      ms: Math.max(0, Math.round(a.ms)),
    };
    if (a.answer !== undefined) payload.answer = a.answer;
    if (a.expected !== undefined) payload.expected = a.expected;
    payload.hintUsed = a.hintUsed === true;

    asked += 1;
    if (payload.correct === true) { right += 1; graded += 1; }
    else if (payload.correct === false) { graded += 1; }

    api.attempt(payload);
    return payload;
  }

  /**
   * Show the summary and hand control back. api.done() is called from the
   * button rather than the moment the last item is answered, so the learner
   * sees the result before the shell takes the panel away.
   */
  function finish(extra) {
    if (finished) return;
    finished = true;
    const accuracy = graded ? right / graded : null;
    const summary = Object.assign({
      exerciseId: spec.id,
      type: spec.type,
      skill: spec.skill,
      asked,
      graded,
      correct: right,
      accuracy,
      passed: passedWith(accuracy),
    }, extra || {});

    clear(stage);
    clear(foot);
    progress.textContent = '';

    const line = graded
      ? s('summaryGraded', { right, graded })
      : s('summaryUngraded', { asked });
    const pass = summary.passed;
    append(stage, [
      el('p', { class: 'rx-summary', text: line }),
      pass === null ? null : el('p', {
        class: 'rx-summary-pass',
        text: pass ? s('passed') : s('failed'),
      }),
    ]);

    const done = button(s('continue'), () => {
      if (typeof api.done === 'function') api.done(summary);
    }, { class: 'btn btn--primary' });
    foot.appendChild(done);
    focus(done);
    // The result is in the stage, which is not a live region, and focus has
    // just moved to Continue, so a screen reader hears the button and nothing
    // else. say() both clears the last verdict and announces this one.
    say(pass === null ? line : `${line} ${pass ? s('passed') : s('failed')}`);
    return summary;
  }

  /** spec.pass is the tick beside the exercise, never the chapter gate (C3.4). */
  function passedWith(accuracy) {
    const p = spec.pass;
    if (!p || !Number.isFinite(p.accuracy) || accuracy === null) return null;
    return accuracy >= p.accuracy;
  }

  function fail(err) {
    console.error('[runcible]', err);
    clear(stage);
    clear(foot);
    say('');
    progress.textContent = '';
    append(stage, [
      el('p', { class: 'rx-error', text: s('couldNotStart') }),
      el('p', { class: 'rx-error-detail', text: String(err && err.message ? err.message : err) }),
    ]);
    const skip = button(s('skipIt'), () => {
      if (typeof api.done === 'function') api.done({ exerciseId: spec.id, type: spec.type, error: String(err && err.message ? err.message : err) });
    }, { class: 'btn btn--secondary' });
    foot.appendChild(skip);
    focus(skip);
  }

  /**
   * End without grading, for the C2.5 case where an exercise cannot be shown
   * answerably. Nothing is recorded, because a skipped question is not a wrong
   * answer and must not count against the learner.
   */
  function skip(reason) {
    if (finished) return;
    finished = true;
    clear(stage);
    clear(foot);
    say('');
    progress.textContent = '';
    append(stage, [el('p', { class: 'rx-skip', text: reason })]);
    const on = button(s('continue'), () => {
      if (typeof api.done === 'function') api.done({ exerciseId: spec.id, type: spec.type, skipped: true, reason });
    }, { class: 'btn btn--primary' });
    foot.appendChild(on);
    focus(on);
  }

  function destroy() {
    bound.off();
    say('');
    clear(foot);
    clear(stage);
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return {
    root, stage, foot, feedback,
    t, s, on: bound.on,
    setTotal, step, say, explain, record, finish, fail, skip, destroy,
    get asked() { return asked; },
    get correct() { return right; },
  };
}
