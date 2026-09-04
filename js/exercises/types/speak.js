// ── speak ────────────────────────────────────────────────────
// C2.1: TTS models it, the learner says it back. Never graded, correct: null
// always. Required spec fields: items, expect.
//
// There is no branch in this file that can produce true or false. That is the
// decided product position (DESIGN Q6, C2.5): MDN records Safari and Safari iOS
// as unsupported while Apple's own WebKit blog announces the feature in Safari
// 14.1, and caniuse lists Edge unsupported where MDN lists it supported. Two
// authorities disagreeing is not a foundation for a chapter gate. Where
// recognition exists the transcript is shown to the learner as their own
// feedback; where it does not, the exercise says so in one line and offers the
// model to compare against.

import { createSession } from '../session.js';
import { questionFrame, advance } from '../ask.js';
import { el, append, button } from '../dom.js';
import { resolveList, pickItems, fieldValue, displayValue, itemIdOf } from '../items.js';
import {
  cancelSpeech, synthAvailable, hasVoiceFor, speakOpts, warnMissingLang,
  recognitionAvailable, listenOnce,
} from '../speech.js';

export function mount(host, spec, api, ctx) {
  const session = createSession(host, spec, api, ctx);
  let alive = true;

  (async () => {
    const pool = await resolveList(spec.items, api, ctx, spec, 'items');
    warnMissingLang(spec);
    const canSpeak = synthAvailable() && await hasVoiceFor(spec.lang);
    const canHear = recognitionAvailable();
    if (!alive) return;

    const chosen = pickItems(pool, spec.count);
    session.setTotal(chosen.length);

    for (let i = 0; i < chosen.length && alive; i++) {
      session.step();
      const item = chosen[i];
      const line = displayValue(fieldValue(item, spec.expect));
      await askSpeak(session, spec, api, {
        itemId: itemIdOf(item, spec, spec.expect, i),
        line,
        canSpeak,
        canHear,
      });
    }
    if (alive) session.finish();
  })().catch((err) => { if (alive) session.fail(err); });

  return {
    destroy() { alive = false; cancelSpeech(); session.destroy(); },
  };
}

function askSpeak(session, spec, api, q) {
  const frame = questionFrame(session);
  append(frame.promptEl, [
    el('p', { class: 'rx-cue', text: q.line }),
    el('p', { class: 'rx-hintline', text: session.s('sayItAloud') }),
  ]);

  const controls = el('div', { class: 'toolbar rx-speak-controls' });
  if (q.canSpeak) {
    controls.appendChild(button(session.s('hearIt'), () => { api.tts(q.line, speakOpts(spec)); }, {
      class: 'btn btn--secondary',
    }));
  } else {
    append(frame.bodyEl, [el('p', {
      class: 'rx-degraded',
      text: spec.lang
        ? session.s('noVoiceModelLang', { lang: spec.lang })
        : session.s('noVoiceModel'),
    })]);
  }

  let transcript;
  const heard = el('p', { class: 'rx-transcript' });

  if (q.canHear) {
    const listen = button(session.s('sayIt'), async () => {
      listen.disabled = true;
      listen.textContent = session.s('listening');
      session.say(session.s('listeningNow'));
      const got = await listenOnce({ lang: spec.lang });
      listen.disabled = false;
      listen.textContent = session.s('sayIt');
      if (got && got.transcript) {
        transcript = got.transcript;
        heard.textContent = session.s('heard', { transcript: got.transcript });
        session.say(session.s('ownFeedback'));
      } else {
        heard.textContent = got && (got.error === 'not-allowed' || got.error === 'service-not-allowed')
          ? session.s('micBlocked')
          : session.s('heardNothing');
        session.say('');
      }
    }, { class: 'btn btn--secondary' });
    controls.appendChild(listen);
  } else {
    heard.textContent = session.s('noRecognition');
  }

  append(frame.bodyEl, [controls, heard]);
  const started = performance.now();

  return advance(session, session.s('done')).then(() => {
    session.record({
      itemId: q.itemId,
      correct: null,
      ms: performance.now() - started,
      answer: transcript,
      expected: q.line,
      hintUsed: false,
    });
  });
}
