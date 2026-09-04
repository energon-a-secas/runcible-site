// jp.loanword: write an English word in katakana. Contract C2.2.
//
// Why this is a Book module and not the generic `typed` type.
//
// Not because of the two-spelling words. The engine's compare pipeline already
// grades an array-valued `answer`, so `typed` with "answer": "accept" would
// accept both spellings of computer, violin and whisky correctly. That was
// checked in js/exercises/compare.js rather than assumed.
//
// It is a module because of the explanation. `typed` offers one hint, the first
// character of the answer, and says nothing after a wrong answer beyond the
// right string. This game has thirty rules on disk that say *why* a word is
// spelled the way it is, keyed per entry, and showing them is most of the
// teaching. It also has to say "both of these are correct" out loud when an
// entry has two spellings, because a learner who typed the other one needs to
// be told they were right rather than merely not marked wrong.
//
// The scoring authority is the seeded list, every entry of it, and nothing else.
// data/loanwords/seed.json says so itself: "a grader that takes only the first
// is a bug".
//
// data/loanwords/rules.json is used here for hints and for the explanation after
// a wrong answer, and it never grades. The research is explicit about why:
// gemination, whether a final long vowel keeps its bar, and every pre-1950
// borrowing are convention rather than rule, so a rule engine would mark
// カメラ wrong for not being カメーラ.

import { toKatakana } from '../../../js/vendor/wanakana.js';
import { kanaReader } from './kana-input.js';
import { el, add, clear, button, listeners, pick, resolveList, frame, summary } from './ui.js';

/** An entry is askable when it has an English prompt and at least one spelling. */
function usable(entry) {
  return entry && typeof entry.en === 'string' && entry.en !== ''
    && Array.isArray(entry.accept) && entry.accept.length > 0;
}

/** C2.3 item identity. The seeded list already carries it; the verified tail does not. */
function idOf(entry) {
  return entry.id || `lw:${entry.katakana || entry.accept[0]}`;
}

/**
 * The same romaji reader the kana transform registers (C12 A16). This module
 * owns its input and its grading, so it runs both halves itself: the live one
 * on every keystroke, and settle once at submit, before comparing.
 */
const katakana = kanaReader(toKatakana);

/** Katakana as typed, with the spaces a keyboard leaves behind removed. */
function tidy(raw) {
  return String(raw || '').replace(/[\s　]+/g, '').trim();
}

function ruleLines(entry, rules) {
  const ids = Array.isArray(entry.rules) ? entry.rules : [];
  const out = [];
  for (const id of ids) {
    const rule = rules.get(id);
    if (!rule) continue;
    out.push(`${rule.id}. ${rule.pattern}: ${rule.rule}`);
  }
  if (!out.length && entry.rules_note) out.push(entry.rules_note);
  return out;
}

export default function register(runcible) {
  runcible.registerExercise('jp.loanword', {
    mount(host, spec, api) {
      const bound = listeners();
      let alive = true;
      const view = frame(host, {
        title: api.t(spec.title) || 'Write it in katakana',
        lead: 'Type romaji. It turns into katakana as you go. A long vowel bar is a hyphen, and a lone n needs to be typed twice.',
        cls: 'jp--loanword',
      });

      let queue = [];
      let at = 0;
      let asked = 0;
      let right = 0;
      const rules = new Map();

      function ask() {
        if (!alive) return;
        if (at >= queue.length) {
          summary(view, api, {
            asked,
            right,
            note: 'Every answer was graded against the verified word list, never against the rules.',
          });
          return;
        }
        const entry = queue[at];
        const started = performance.now();
        let hintUsed = false;

        clear(view.body);
        clear(view.foot);
        view.status.textContent = `${at + 1} of ${queue.length}`;

        const input = el('input', {
          type: 'text',
          class: 'rx-input jp-input',
          autocomplete: 'off',
          autocapitalize: 'off',
          autocorrect: 'off',
          spellcheck: 'false',
          'aria-label': 'Your answer in katakana',
        });
        bound.on(input, 'input', () => {
          const caretAtEnd = input.selectionStart === input.value.length;
          const next = katakana(input.value);
          if (next === input.value) return;
          input.value = next;
          if (caretAtEnd) input.setSelectionRange(next.length, next.length);
        });

        const form = el('form', { class: 'rx-form toolbar' });
        add(form, [input, el('button', { type: 'submit', class: 'btn btn--primary', text: 'Check' })]);
        const hint = button('Hint', () => {
          hintUsed = true;
          hint.disabled = true;
          const lines = ruleLines(entry, rules);
          add(view.body, el('div', { class: 'jp-hint' }, [
            el('p', { text: `It is ${entry.accept[0].length} kana long.` }),
            ...lines.map((line) => el('p', { class: 'jp-rule', text: line })),
          ]));
        }, 'btn btn--ghost btn--sm');

        add(view.body, [
          el('p', { class: 'jp-prompt jp-prompt--en', text: entry.en }),
          form,
        ]);
        view.foot.appendChild(hint);

        bound.on(form, 'submit', (e) => {
          e.preventDefault();
          const answer = tidy(katakana.settle(input.value));
          if (!answer) { input.focus(); return; }
          const correct = entry.accept.some((a) => tidy(a) === answer);
          asked += 1;
          if (correct) right += 1;
          api.attempt({
            itemId: idOf(entry),
            skill: spec.skill,
            correct,
            ms: Math.round(performance.now() - started),
            answer,
            expected: entry.accept[0],
            hintUsed,
          });
          verdict(entry, correct, answer);
        });

        input.focus();
      }

      function verdict(entry, correct, answer) {
        clear(view.body);
        clear(view.foot);
        const both = entry.accept.length > 1;
        add(view.body, [
          el('p', { class: `jp-verdict jp-verdict--${correct ? 'right' : 'wrong'}`, text: correct ? 'Correct.' : 'Not that one.' }),
          el('p', { class: 'jp-prompt', text: entry.accept.join('   or   ') }),
          both ? el('p', { class: 'jp-note', text: 'Both of those are correct. The dictionary lists them both, so the game accepts them both.' }) : null,
          correct ? null : el('p', { class: 'jp-note', text: `You wrote ${answer}` }),
          entry.romaji ? el('p', { class: 'jp-note', text: entry.romaji }) : null,
          ...ruleLines(entry, rules).map((line) => el('p', { class: 'jp-rule', text: line })),
        ]);
        const go = button(at + 1 >= queue.length ? 'See the score' : 'Next', () => { at += 1; ask(); }, 'btn btn--primary');
        view.foot.appendChild(go);
        go.focus();
      }

      (async () => {
        try {
          const items = (await resolveList(api, spec.items, 'items')).filter(usable);
          const props = spec.props || {};
          if (props.rules) {
            for (const rule of await resolveList(api, props.rules, 'props.rules')) {
              if (rule && rule.id) rules.set(rule.id, rule);
            }
          }
          if (!alive) return;
          if (!items.length) {
            view.status.textContent = 'No word in this list carries both an English prompt and a spelling, so there is nothing to ask.';
            return;
          }
          queue = pick(items, spec.count);
          ask();
        } catch (err) {
          if (!alive) return;
          clear(view.body);
          add(view.body, el('p', { class: 'rx-error', text: `This game could not load its word list: ${err.message}` }));
          console.error('[japanese] jp.loanword', err);
        }
      })();

      return {
        destroy() {
          alive = false;
          bound.off();
          clear(host);
        },
      };
    },
  });
}
