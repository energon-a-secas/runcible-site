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
// right string. This game has thirty-two rules on disk that say *why* a word
// is spelled the way it is, keyed per entry, and showing them is most of the
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
//
// What a learner is shown is the `explain` line, {en, es}, a sentence written
// for a beginner: the word's own line from seed.json first, because it says
// why THIS word has these beats, then its rules' lines from rules.json. The
// researcher's `rule` field (IPA, table numbers, a Wikipedia aside) is the
// fallback only, for a row that has no learner line. Everything is counted in
// beats, not characters, so the hint and the verdict agree with chapter 0:
// チョコレート is five beats in six kana.

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

/** The small kana that ride on the beat before them. */
const SMALL = 'ァィゥェォャュョヮぁぃぅぇぉゃゅょゎ';

/**
 * One kana is one beat; a small kana joins the beat before it. ッ, ー and ン
 * are beats of their own, which is the point of the game. The same split
 * tools/build-sets.mjs makes for the Quiz beats set, so the two cannot
 * disagree about a word.
 */
export function beats(kana) {
  const out = [];
  for (const ch of String(kana || '')) {
    if (out.length && SMALL.includes(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

function beatCount(n) {
  return n === 1 ? '1 beat' : `${n} beats`;
}

/**
 * The accepted spelling to diff against: the one that agrees with the answer
 * for the longest run of beats. With two spellings (computer, violin, whisky)
 * accept[0] is an arbitrary target; a learner who wrote ヴァイオリソ was one
 * beat off ヴァイオリン, not four off バイオリン.
 */
export function closest(entry, answer) {
  const typed = beats(tidy(answer));
  let best = entry.accept[0];
  let bestRun = -1;
  for (const a of entry.accept) {
    const want = beats(tidy(a));
    let k = 0;
    while (k < typed.length && k < want.length && typed[k] === want[k]) k += 1;
    if (k > bestRun) { bestRun = k; best = a; }
  }
  return best;
}

/** Where the answer first leaves the right spelling, beat by beat, or null when it never does. */
export function firstDifference(answer, want) {
  const a = beats(tidy(answer));
  const w = beats(tidy(want));
  const n = Math.max(a.length, w.length);
  for (let k = 0; k < n; k++) {
    if (a[k] === w[k]) continue;
    if (a[k] === undefined) return `Beat ${k + 1} is missing: it is ${w[k]}.`;
    if (w[k] === undefined) return `Beat ${k + 1} is extra: you wrote ${a[k]}, and the word ends after ${beatCount(k)}.`;
    return `The first difference is beat ${k + 1}: you wrote ${a[k]}, it is ${w[k]}.`;
  }
  return null;
}

/** A bilingual {en, es} (or a string) in the reader's language, through api.t. */
function say(api, value) {
  if (api && typeof api.t === 'function') {
    const out = api.t(value);
    if (typeof out === 'string' && out !== '') return out;
  }
  if (typeof value === 'string') return value;
  return value && typeof value.en === 'string' ? value.en : '';
}

/**
 * The learner lines for one entry, in the order a teacher would say them:
 * the word's own explain line, then one line per rule. A verified-tail entry
 * with no rules array still names its salient rule in en_source, and that is
 * better than nothing. The researcher's row text is the fallback for a rule
 * with no learner line, with its examples appended so the row stops hiding
 * the one thing on it a learner could use.
 */
function ruleLines(entry, rules, api, { own = true } = {}) {
  const out = [];
  const mine = own ? say(api, entry.explain) : '';
  if (mine) out.push(mine);
  const ids = Array.isArray(entry.rules) && entry.rules.length
    ? entry.rules
    : (typeof entry.en_source === 'string' && entry.en_source ? [entry.en_source] : []);
  for (const id of ids) {
    const rule = rules.get(id);
    if (!rule) continue;
    const line = say(api, rule.explain);
    if (line) out.push(line);
    else out.push(`${rule.pattern}: ${rule.rule}${rule.examples_text ? ` (${rule.examples_text})` : ''}`);
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
          // The count is in beats, as chapter 0 taught it. When the kana count
          // differs (ファン, ジュース) both are said, because the learner is
          // about to type one and count the other. The word's own explain
          // line is held back: it is written for the verdict and names the
          // answer. The rules' lines are the teaching, and the attempt
          // records that they were asked for.
          const want = beats(tidy(entry.accept[0]));
          const kana = tidy(entry.accept[0]).length;
          const count = want.length === kana
            ? `It is ${beatCount(want.length)} long.`
            : `It is ${beatCount(want.length)} long, in ${kana} kana: a small kana shares the beat before it.`;
          const lines = ruleLines(entry, rules, api, { own: false });
          add(view.body, el('div', { class: 'jp-hint' }, [
            el('p', { text: count }),
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

      /**
       * What a teacher says after the answer: the word, its spelling, the
       * beats, the first beat that went wrong, how to type it, and why.
       */
      function verdict(entry, correct, answer) {
        clear(view.body);
        clear(view.foot);
        const both = entry.accept.length > 1;
        const want = correct ? answer : closest(entry, answer);
        const wantBeats = beats(tidy(want));
        const diff = correct ? null : firstDifference(answer, want);
        add(view.body, [
          el('p', {
            class: `jp-verdict jp-verdict--${correct ? 'right' : 'wrong'}`,
            text: correct ? 'Correct.' : `Not that one. ${entry.en} is ${want}.`,
          }),
          el('p', { class: 'jp-prompt', text: entry.accept.join('   or   ') }),
          both ? el('p', { class: 'jp-note', text: 'Both of those are correct. The dictionary lists them both, so the game accepts them both.' }) : null,
          correct
            ? el('p', { class: 'jp-note', text: `${beatCount(wantBeats.length)}: ${wantBeats.join(' ')}.` })
            : el('p', { class: 'jp-note', text: `You wrote ${answer}, ${beatCount(beats(answer).length)}. It is ${want}, ${beatCount(wantBeats.length)}: ${wantBeats.join(' ')}.` }),
          diff ? el('p', { class: 'jp-note', text: diff }) : null,
          entry.typed
            ? el('p', { class: 'jp-note', text: `Typed as ${entry.typed}` })
            : (entry.romaji ? el('p', { class: 'jp-note', text: entry.romaji }) : null),
          ...ruleLines(entry, rules, api).map((line) => el('p', { class: 'jp-rule', text: line })),
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
