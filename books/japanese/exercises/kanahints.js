// jp.kanahints: learn a row of kana from a picture, then check it.
//
// The flow follows the Japan Foundation Memory Hint apps, with none of their
// content: a picture and a keyword first, then the character fading in, then
// quick questions by row, look-alikes among them. The keywords, stories and
// rule mnemonics are this Book's own (data/kana/mnemonics.json, CC0); the
// stroke paths are KanjiVG's, already declared by the chapters that use this.
//
// Two phases per row. Learn shows one kana at a time and records nothing.
// Check asks every kana of the row once, in one of four modes: kana to romaji,
// romaji to kana, sound to kana (only when the device has a Japanese voice,
// and a question it cannot play is skipped and never recorded), and
// look-alikes, where the distractors are the kana the hint names as easy to
// confuse. Every check answer is one attempt under the spec's own skill (the
// chapter goal's, like the rung's Quiz rounds) with the kana table's id as
// itemId (kana:X, the id the typed drills over the same table carry).
//
// A hint comes back after a miss and never after a right answer. The studies
// behind 8-study-plan's page on this found that a picture helps introduce a
// character and repair a miss, and that lasting memory comes from recall, not
// from seeing the picture again every time.
//
// spec.props: rows (the table's row ids, e.g. ["vowels"] or ["k", "s"]; "a"
// is accepted for the vowel row), script ("hiragana" or "katakana"), and
// optionally kana, hints, strokes to point at other files.

import { el, button, clear, shuffle } from './ui.js';
import {
  T, REVEAL_MS, say, reducedMotion, japaneseVoice, frame, speakOut, learnCard, hintPanel,
  optionRows, romajiLabel, glyphNode, stageWith,
} from './kanahints-view.js';

const TABLES = { hiragana: 'data/kana/hiragana.json', katakana: 'data/kana/katakana.json' };
const HINTS = 'data/kana/mnemonics.json';
const STROKES = 'data/kanji/strokes-kana.json';
const ALIAS = { a: 'vowels' };
/** The order modes are dealt in, so a row of five sees most of them. */
const MODES = ['kana', 'romaji', 'lookalike', 'sound'];
const OPTIONS = { kana: 4, romaji: 4, sound: 3 };

const sameSound = (a, b) => a.accept.some((x) => b.accept.includes(x));

/** Load the table, the hints and the strokes, and shape the rows this spec names. */
async function load(api, props) {
  const script = props.script === 'katakana' ? 'katakana' : 'hiragana';
  const [table, hints, strokes] = await Promise.all([
    api.data(props.kana || TABLES[script]),
    api.data(props.hints || HINTS),
    // The figure is a help, not the lesson: a missing stroke file says so on
    // the card and the round goes on.
    Promise.resolve(api.data(props.strokes || STROKES)).catch(() => null),
  ]);
  const wanted = (Array.isArray(props.rows) ? props.rows : [props.rows]).filter(Boolean).map((r) => ALIAS[r] || r);
  const rowsOf = (table && table.rows) || {};
  const unknown = wanted.filter((r) => !Array.isArray(rowsOf[r]));
  if (!wanted.length || unknown.length) throw new Error(say(api, T.unknownRow, { row: unknown.join(', ') || '(none)' }));

  const book = (hints && hints[script]) || {};
  const pool = [];
  for (const row of table.row_order || Object.keys(rowsOf)) {
    for (const e of rowsOf[row] || []) {
      const rec = strokes && strokes[e.glyph];
      pool.push({
        id: e.id,
        glyph: e.glyph,
        romaji: e.romaji,
        accept: Array.isArray(e.accept) && e.accept.length ? e.accept : [e.romaji],
        row,
        hint: book[e.id] || null,
        strokes: rec && Array.isArray(rec.s) && rec.s.length ? rec : null,
      });
    }
  }
  const rows = wanted.map((id) => ({ id, entries: pool.filter((p) => p.row === id) }));
  return { rows, pool };
}

/** The same-script look-alikes a hint names, never one that sounds the same. */
function lookalikes(entry, pool) {
  const named = entry.hint && Array.isArray(entry.hint.contrast) ? entry.hint.contrast.map((c) => c.kana) : [];
  return pool.filter((p) => named.includes(p.glyph) && !sameSound(p, entry)).slice(0, 2);
}

/** Distractors: the row first, then rows already met here, then the rest of the table. */
function distractors(entry, pool, met, n) {
  const fresh = pool.filter((p) => p.id !== entry.id && !sameSound(p, entry));
  const groups = [
    fresh.filter((p) => p.row === entry.row),
    fresh.filter((p) => p.row !== entry.row && met.has(p.row)),
    fresh.filter((p) => p.row !== entry.row && !met.has(p.row)),
  ];
  const out = [];
  for (const group of groups) {
    for (const p of shuffle(group)) {
      if (out.length >= n) return out;
      if (!out.some((q) => q.glyph === p.glyph || romajiLabel(q) === romajiLabel(p))) out.push(p);
    }
  }
  return out;
}

/** Deal the row's questions: every kana once, the modes rotating over what each allows. */
function plan(entries, pool, voice) {
  return shuffle(entries).map((entry, i) => {
    const allowed = new Set(['kana', 'romaji']);
    if (voice) allowed.add('sound');
    if (lookalikes(entry, pool).length) allowed.add('lookalike');
    for (let k = 0; k < MODES.length; k += 1) {
      const mode = MODES[(i + k) % MODES.length];
      if (allowed.has(mode)) return { entry, mode };
    }
    return { entry, mode: 'kana' };
  });
}

/** One question's prompt text, options and the label of the right answer. */
function build(api, q, pool, met) {
  const { entry, mode } = q;
  const asGlyph = mode !== 'kana';
  const others = mode === 'lookalike' ? lookalikes(entry, pool) : distractors(entry, pool, met, OPTIONS[mode] - 1);
  const options = shuffle([entry, ...others]).map((p) => ({
    entry: p,
    glyph: asGlyph,
    label: asGlyph ? p.glyph : romajiLabel(p),
    correct: p.id === entry.id,
  }));
  const ask = api.t({ kana: T.qKana, romaji: T.qRomaji, sound: T.qSound, lookalike: T.qLookalike }[mode]);
  return { ask, options, expected: asGlyph ? entry.glyph : romajiLabel(entry) };
}

export default function register(runcible) {
  runcible.registerExercise('jp.kanahints', {
    mount(host, spec, api) {
      const timers = new Set();
      let alive = true;
      let releaseKeys = () => {};
      const props = spec.props || {};
      const view = frame(host, api.t(spec.title) || api.t(T.title));

      let rows = [];
      let pool = [];
      let voice = false;
      const met = new Set();
      let r = 0;
      let at = 0;
      let deck = [];
      let asked = 0;
      let right = 0;
      let rowAsked = 0;
      let rowRight = 0;

      const later = (fn, ms) => {
        const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms);
        timers.add(id);
      };
      const focus = (node) => { if (node && alive) { try { node.focus({ preventScroll: true }); } catch { node.focus(); } } };
      const stamp = (phase, i, n) => {
        const parts = [];
        if (rows.length > 1) parts.push(say(api, T.rowOf, { r: r + 1, n: rows.length }));
        parts.push(say(api, phase === 'learn' ? T.learnAt : T.checkAt, { i, n }));
        view.progress.textContent = parts.join(' · ');
      };
      const speak = (glyph) => Promise.resolve(api.tts(glyph)).then((ok) => ok === true).catch(() => false);

      function fail(message) {
        releaseKeys();
        speakOut(view, '');
        view.progress.textContent = '';
        stageWith(view, [el('p', { class: 'rx-error', text: say(api, T.loadError, { msg: message }) })]);
        const skip = button(api.t(T.skip), () => api.done({ exerciseId: spec.id, type: spec.type, error: message }), 'btn btn--secondary');
        view.foot.appendChild(skip);
        focus(skip);
      }

      // ── Learn ─────────────────────────────────────────────────
      function showLearn() {
        const row = rows[r];
        const entry = row.entries[at];
        const reveal = !reducedMotion();
        const { card, glyph } = learnCard(api, entry, {
          reveal,
          lead: r === 0 && at === 0 ? api.t(T.lead) : null,
        });
        speakOut(view, '');
        stamp('learn', at + 1, row.entries.length);
        stageWith(view, [card, voice ? null : el('p', { class: 'rx-note', text: api.t(T.noVoice) })]);
        if (reveal) later(() => { glyph.dataset.reveal = 'shown'; }, REVEAL_MS);

        const last = at >= row.entries.length - 1;
        const go = button(api.t(last ? T.toCheck : T.next), () => {
          if (last) startCheck(); else { at += 1; showLearn(); }
        }, 'btn btn--primary');
        if (voice) {
          view.foot.appendChild(button(api.t(T.hear), () => {
            speak(entry.glyph).then((ok) => { if (alive && !ok) speakOut(view, api.t(T.voiceFailed)); });
          }, 'btn btn--secondary btn--sm'));
        }
        if (!last) view.foot.appendChild(button(api.t(T.skipLearn), () => startCheck(), 'btn btn--ghost btn--sm'));
        view.foot.appendChild(go);
        focus(go);
      }

      // ── Check ─────────────────────────────────────────────────
      function startCheck() {
        deck = plan(rows[r].entries, pool, voice);
        at = 0;
        rowAsked = 0;
        rowRight = 0;
        showQuestion();
      }

      function showQuestion() {
        releaseKeys();
        if (at >= deck.length) return rowDone();
        const q = deck[at];
        // A voice that stopped answering mid-row turns its questions into reading ones.
        if (q.mode === 'sound' && !voice) q.mode = 'kana';
        const { ask, options, expected } = build(api, q, pool, met);
        const shownAt = performance.now();
        let answered = false;
        speakOut(view, '');
        stamp('check', at + 1, deck.length);

        const prompt = el('div', { class: 'stack stack--tight' }, [
          el('p', { class: 'rx-cue', text: ask }),
          q.mode === 'kana' ? glyphNode(q.entry.glyph, false) : null,
          q.mode === 'romaji' || q.mode === 'lookalike' ? el('p', { class: 'rx-prompt', text: romajiLabel(q.entry) }) : null,
        ]);
        const rowsUi = optionRows(api, options, (opt, btn) => {
          if (answered) return;
          answered = true;
          rowsUi.close(btn);
          const correct = opt.correct === true;
          api.attempt({
            itemId: q.entry.id,
            skill: spec.skill,
            correct,
            ms: Math.round(performance.now() - shownAt),
            answer: opt.label,
            expected,
            hintUsed: false,
          });
          asked += 1;
          rowAsked += 1;
          if (correct) { right += 1; rowRight += 1; }
          if (correct) speakOut(view, api.t(T.right), 'correct');
          else {
            speakOut(view, say(api, T.wrong, { glyph: q.entry.glyph, romaji: romajiLabel(q.entry) }), 'wrong');
            view.feedback.appendChild(hintPanel(api, q.entry, opt.entry));
          }
          onward();
        });
        releaseKeys = rowsUi.release;

        const extra = [];
        if (q.mode === 'sound') {
          const again = button(api.t(T.play), () => {
            speak(q.entry.glyph).then((ok) => { if (!ok && alive && !answered) skipSound(); });
          }, 'btn btn--secondary btn--sm');
          extra.push(el('div', { class: 'toolbar' }, [again]));
          // The first play is automatic; a refusal here is often the browser
          // wanting a gesture, so it leaves the button rather than skipping.
          speak(q.entry.glyph);
        }
        stageWith(view, [prompt, ...extra, rowsUi.list, rowsUi.hint]);
        focus(rowsUi.buttons[0]);

        function skipSound() {
          answered = true;
          rowsUi.close(null);
          voice = false;
          speakOut(view, api.t(T.soundSkipped));
          onward();
        }
      }

      function onward() {
        releaseKeys();
        const last = at >= deck.length - 1;
        const go = button(api.t(last ? T.finish : T.next), () => { at += 1; showQuestion(); }, 'btn btn--primary rx-next');
        view.foot.appendChild(go);
        focus(go);
      }

      function rowDone() {
        met.add(rows[r].id);
        if (r >= rows.length - 1) return end();
        const line = say(api, T.rowScore, { right: rowRight, asked: rowAsked });
        speakOut(view, line, '', true);
        view.progress.textContent = '';
        stageWith(view, [el('p', { class: 'rx-summary', text: line })]);
        const go = button(api.t(T.nextRow), () => { r += 1; at = 0; showLearn(); }, 'btn btn--primary');
        view.foot.appendChild(button(api.t(T.stopHere), () => end(), 'btn btn--ghost btn--sm'));
        view.foot.appendChild(go);
        focus(go);
      }

      function end() {
        releaseKeys();
        view.progress.textContent = '';
        const line = asked ? say(api, T.score, { right, asked }) : api.t(T.none);
        stageWith(view, [el('p', { class: 'rx-summary', text: line })]);
        speakOut(view, line, '', true);
        const accuracy = asked ? right / asked : null;
        const pass = spec.pass && Number.isFinite(spec.pass.accuracy) && accuracy !== null
          ? accuracy >= spec.pass.accuracy : null;
        const go = button(api.t(T.go), () => api.done({
          exerciseId: spec.id,
          type: spec.type,
          skill: spec.skill,
          asked,
          graded: asked,
          correct: right,
          accuracy,
          passed: pass,
        }), 'btn btn--primary');
        view.foot.appendChild(go);
        focus(go);
      }

      if (!spec.skill) {
        fail(api.t(T.noSkill));
      } else {
        Promise.all([load(api, props), japaneseVoice()]).then(([got, hasVoice]) => {
          if (!alive) return;
          rows = got.rows;
          pool = got.pool;
          voice = hasVoice;
          showLearn();
        }).catch((err) => {
          if (!alive) return;
          console.error('[runcible] jp.kanahints could not start', err);
          fail(err && err.message ? err.message : String(err));
        });
      }

      return {
        destroy() {
          alive = false;
          releaseKeys();
          for (const id of timers) clearTimeout(id);
          timers.clear();
          if (globalThis.speechSynthesis) globalThis.speechSynthesis.cancel();
          clear(host);
        },
      };
    },
  });
}
