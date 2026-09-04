// ── listen ───────────────────────────────────────────────────
// C2.1: TTS speaks, the learner picks or types. Graded.
// Required spec fields: items, speak, answer, respond ("choice" | "typed").
//
// C2.5 fact 2 is implemented here, and the split it asks for is decided by the
// spec rather than guessed:
//
//   no voice for spec.lang, and the spoken field is not the answered field
//     -> degrade to text, and say so on the page
//   no voice for spec.lang, and the spoken field IS the answered field
//     -> the only prompt is audio, so showing it would hand over the answer.
//        Skip the exercise rather than show it unanswerable. Nothing is
//        recorded: a skipped question is not a wrong one.
//
// spec.audioOnly: true forces the second branch for a spec where the text would
// give the answer away less directly.
//
// No language is named here. spec.lang is a BCP 47 tag, which the shell fills
// in from the Book's lang.content when the chapter does not state one
// (js/render.js). With neither, there is nothing to check a voice against, so
// the degrade path cannot fire and warnMissingLang says so on the console
// rather than letting it pass quietly.

import { createSession } from '../session.js';
import { el, append, button } from '../dom.js';
import {
  resolveList, pickItems, fieldValue, displayValue, itemIdOf, distractorsFor, shuffle,
} from '../items.js';
import { askChoice } from './choice.js';
import { askTyped } from './typed.js';
import { hasVoiceFor, cancelSpeech, synthAvailable, speakOpts, warnMissingLang } from '../speech.js';

const REPLAY_KEY = 'r';

export function mount(host, spec, api, ctx) {
  const session = createSession(host, spec, api, ctx);
  let alive = true;

  (async () => {
    const pool = await resolveList(spec.items, api, ctx, spec, 'items');
    warnMissingLang(spec);

    // C2.5 fact 1: this resolves only after voiceschanged on Chrome.
    const canSpeak = synthAvailable() && await hasVoiceFor(spec.lang);
    if (!alive) return;

    const answerIsSpoken = spec.audioOnly === true || spec.speak === spec.answer;
    if (!canSpeak && answerIsSpoken) {
      session.skip(spec.lang
        ? session.s('audioOnlySkipLang', { lang: spec.lang })
        : session.s('audioOnlySkip'));
      return;
    }

    const chosen = pickItems(pool, spec.count);
    session.setTotal(chosen.length);

    for (let i = 0; i < chosen.length && alive; i++) {
      session.step();
      const item = chosen[i];
      const spoken = displayValue(fieldValue(item, spec.speak));
      const expectedRaw = fieldValue(item, spec.answer);
      const expected = displayValue(expectedRaw);
      const itemId = itemIdOf(item, spec, spec.speak, i);

      const renderPrompt = (target) => {
        if (canSpeak) {
          const play = button(session.s('playIt'), () => { api.tts(spoken, speakOpts(spec)); }, {
            class: 'btn btn--primary rx-play',
          });
          append(target, [
            play,
            el('p', { class: 'rx-hintline', text: session.s('replayKey') }),
          ]);
          api.tts(spoken, speakOpts(spec));
        } else {
          append(target, [
            el('p', { class: 'rx-cue', text: spoken }),
            el('p', {
              class: 'rx-degraded',
              text: spec.lang
                ? session.s('noVoiceTextLang', { lang: spec.lang })
                : session.s('noVoiceText'),
            }),
          ]);
        }
      };

      const onKey = (e) => {
        if (!canSpeak) return;
        if (e.key !== REPLAY_KEY && e.key !== REPLAY_KEY.toUpperCase()) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        api.tts(spoken, speakOpts(spec));
      };
      document.addEventListener('keydown', onKey);
      session.on(session.root, 'rx-teardown', () => document.removeEventListener('keydown', onKey));

      try {
        if (spec.respond === 'typed') {
          await askTyped(session, spec, {
            itemId,
            expected: expectedRaw,
            expectedLabel: expected,
            transform: spec.transformFn,
            renderPrompt,
          });
        } else {
          const wrong = distractorsFor(spec, item, pool, spec.answer, ctx);
          const options = shuffle(
            [{ label: expected, correct: true }].concat(wrong.map((w) => ({ label: w, correct: false }))),
          );
          await askChoice(session, { itemId, options, expectedLabel: expected, renderPrompt });
        }
      } finally {
        document.removeEventListener('keydown', onKey);
      }
    }
    if (alive) session.finish();
  })().catch((err) => { if (alive) session.fail(err); });

  return {
    destroy() {
      alive = false;
      cancelSpeech();
      session.root.dispatchEvent(new Event('rx-teardown'));
      session.destroy();
    },
  };
}
