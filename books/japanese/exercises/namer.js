// jp.namer: your name in katakana.
//
// Never graded. correct: null on every attempt, and there is no branch here
// that can produce true or false. That is not caution, it is the truth about
// the data: a name in katakana is settled by how it sounds and by what its
// owner decides, and this module has neither.
//
// It asks for the SOUNDS, not the spelling, and that is the whole design.
//
// The first version of this file fed the raw name to the romaji converter and
// showed the result. Typing three real names into it in a browser produced
// "Luciano" as a small u followed by ki-a-no, and "Alexander Smith" with Latin
// letters still sitting in the middle of the katakana. Both are nonsense, and
// dressing them in a disclaimer would have made it worse rather than better.
//
// The failure is the lesson. The research says it in one line: English spelling
// does not predict katakana, and converting a word properly needs a
// pronunciation dictionary this site does not ship. So the learner supplies the
// pronunciation, one beat at a time, which is exactly the skill chapter 0
// taught, and the converter does the only job it is actually good at: turning
// beats into kana.

import { toKatakana } from '../../../js/vendor/wanakana.js';
import { el, add, clear, button, listeners, resolveList, frame } from './ui.js';

const EXAMPLES = [
  ['Luciano', 'ru-shi-a-no', 'l has no beat of its own, so it borrows the r row'],
  ['Smith', 'su-mi-su', 'sm cannot stack, and a stranded s takes u'],
  ['Kate', 'ke-i-to', 'the vowel is a diphthong, and the stranded t takes o'],
  ['Vivian', 'vi-vi-a-nn', 'v is written with u plus two dots, and a lone n is typed twice'],
];

/** Anything the converter could not turn into a beat. */
function leftovers(text) {
  const bad = [];
  for (const ch of String(text || '')) {
    if (/[a-zA-Z]/.test(ch) && !bad.includes(ch)) bad.push(ch);
  }
  return bad;
}

export default function register(runcible) {
  runcible.registerExercise('jp.namer', {
    // Never graded: Today must not offer it as the day's game or count it as a drill.
    graded: false,
    mount(host, spec, api) {
      const bound = listeners();
      let alive = true;
      const view = frame(host, {
        title: api.t(spec.title) || 'Your name in katakana',
        lead: 'Spell it the way it sounds, one beat at a time, with hyphens between the beats.',
        cls: 'jp--namer',
      });

      const input = el('input', {
        type: 'text',
        class: 'rx-input jp-input',
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        placeholder: 'ru-shi-a-no',
        'aria-label': 'Your name, spelled out in beats',
      });
      const out = el('p', { class: 'jp-prompt', lang: 'ja' });
      const trouble = el('p', { class: 'jp-note' });
      const stuck = el('p', { class: 'jp-note jp-note--warn' });

      // Live conversion, the same as every other typed field in this Book.
      bound.on(input, 'input', () => {
        const raw = input.value.replace(/-/g, '');
        const kana = toKatakana(raw, { IMEMode: true });
        out.textContent = kana;
        const bad = leftovers(kana);
        stuck.textContent = bad.length
          ? `These letters have no beat yet: ${bad.join(' ')}. Every beat is one consonant and one vowel, so give each of them a vowel and try again.`
          : '';
      });

      const speak = button('Hear it', () => {
        if (!out.textContent) return;
        Promise.resolve(api.tts(out.textContent)).then((ok) => {
          if (alive && !ok) trouble.textContent = 'This browser has no Japanese voice, so there is no audio.';
        });
      }, 'btn btn--ghost btn--sm');

      const keep = button('That is mine', () => {
        if (!out.textContent) return;
        api.attempt({
          itemId: 'jp:name',
          skill: spec.skill,
          correct: null,
          ms: 0,
          answer: out.textContent,
        });
        trouble.textContent = 'Kept. Nothing about it was scored, because there is nothing to score it against.';
      }, 'btn btn--secondary btn--sm');

      add(view.body, [
        el('div', { class: 'toolbar' }, [input, speak, keep]),
        out,
        stuck,
        trouble,
        el('h5', { class: 'jp-sub', text: 'Worked examples' }),
        el('ul', { class: 'jp-examples' }, EXAMPLES.map(([name, beats, why]) => el('li', {}, [
          el('span', { class: 'jp-example-name', text: `${name}: ` }),
          el('span', { class: 'jp-example-beats', text: beats }),
          el('span', { class: 'jp-note', text: why }),
        ]))),
        el('h5', { class: 'jp-sub', text: 'What this is not' }),
        el('p', { class: 'jp-note', text: 'It does not know how your name is pronounced. You decide the beats and it writes them down, which is the only half of the job that can be done without a pronunciation dictionary.' }),
        el('p', { class: 'jp-note', text: 'A Japanese speaker writing your name would go by ear. Two people spelled the same can end up written differently, and both are right.' }),
      ]);
      add(view.foot, button('Done', () => api.done({ graded: false }), 'btn btn--primary'));
      view.status.textContent = 'Nothing here is scored.';

      (async () => {
        const props = spec.props || {};
        if (!props.rules) return;
        try {
          const wanted = ['B1', 'B7', 'B8', 'B28'];
          const rules = (await resolveList(api, props.rules, 'props.rules')).filter((r) => r && wanted.includes(r.id));
          if (!alive || !rules.length) return;
          add(view.body, [
            el('h5', { class: 'jp-sub', text: 'The rules doing the work' }),
            ...rules.map((rule) => el('p', { class: 'jp-rule', text: `${rule.id}. ${rule.pattern}: ${rule.rule}` })),
          ]);
        } catch (err) {
          console.error('[japanese] jp.namer could not load its rules', err);
        }
      })();

      input.focus();

      return {
        destroy() {
          alive = false;
          bound.off();
          if (globalThis.speechSynthesis) globalThis.speechSynthesis.cancel();
          clear(host);
        },
      };
    },
  });
}
