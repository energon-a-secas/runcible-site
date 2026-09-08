// piano.keys and piano.staff: the two drills whose prompt is a picture.
//
// The sentence C2.1 asks for before a Book writes a module, once for both:
// none of the nine generic types can put a key on a keyboard or a note on a
// stave as the prompt. `choice` and `typed` prompt with the value of a field,
// and a data file can hold the name of a note but not the note standing in a
// bar of the piece the learner is about to play. Everything else here is
// deliberately the generic shape: one item, one question, one attempt, and the
// same summary panel a generic drill ends with.
//
// Two item shapes reach piano.staff, and it tells them apart by the fields
// they carry rather than by a flag in the chapter:
//
//   a note   { id, name, clef, d }        chapter 2, one note on one stave
//   a bar    { id, n, notes: [ ... ] }    chapter 4, a bar of a real piece
//
// A bar needs its clef, its key signature and its time signature, and those
// belong to the piece rather than to the bar, so a chapter drilling a piece
// points `props.piece` at the piece record in the same declared file. Both
// pointers name a file the manifest permits, which is what C1 rule 2 is for.

import { frame, summary, askDrawn, resolveList, pick, shuffle, el } from './ui.js';
import { drawBar, drawNote, drawKeyboard } from './draw.js';

/** Resolve `items` plus any extra pointers in `props.also`, in order. */
async function poolFor(api, spec) {
  const props = spec.props || {};
  const out = await resolveList(api, spec.items, 'items');
  for (const extra of Array.isArray(props.also) ? props.also : []) {
    const more = await resolveList(api, extra, 'props.also');
    out.push(...more);
  }
  return out;
}

/** Three wrong labels, drawn from the pool and never equal to the right one. */
function optionsFor(right, labels, n = 3) {
  const wrong = [];
  for (const label of shuffle(labels)) {
    if (label === right || wrong.includes(label)) continue;
    wrong.push(label);
    if (wrong.length === n) break;
  }
  return shuffle([right, ...wrong]);
}

/**
 * The shared run: ask each question, record one attempt at the moment it is
 * answered, then the panel. C2.3 is the whole spine, so the attempt is made
 * where the answer is, not where the learner presses Next.
 */
async function runQuestions(view, api, spec, questions, note) {
  let right = 0;
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    view.status.textContent = `${i + 1} of ${questions.length}`;
    const record = (correct, ms, answer) => {
      if (correct) right += 1;
      api.attempt({
        itemId: q.itemId,
        skill: spec.skill,
        correct,
        ms,
        answer,
        expected: q.expected,
      });
    };
    // eslint-disable-next-line no-await-in-loop
    await askDrawn(view, { ...q, onAnswer: record });
  }
  summary(view, api, { asked: questions.length, right, note });
  return right;
}

export default function register(runcible) {
  runcible.registerExercise('piano.keys', {
    mount(host, spec, api) {
      let alive = true;
      const view = frame(host, {
        title: api.t(spec.title) || 'Name the marked key',
        lead: 'Every key is found from the black key groups, never counted from the end of the keyboard.',
        cls: 'pf--keys',
      });
      view.status.textContent = 'Loading the keyboard.';

      (async () => {
        const pool = await poolFor(api, spec);
        if (!alive) return;
        if (!pool.length) { view.status.textContent = 'This drill was given no keys to ask about.'; return; }
        const labels = pool.map((k) => k.name);
        const questions = pick(pool, spec.count).map((item) => ({
          itemId: item.id,
          expected: item.name,
          options: optionsFor(item.name, labels),
          after: item.note || null,
          prompt: [
            drawKeyboard(item.pc),
            el('p', { class: 'pf-cue', text: 'Which key is marked?' }),
          ],
        }));
        await runQuestions(view, api, spec, questions,
          'A black key has two names and both are right. Which one a score prints depends on the key it is in.');
      })().catch((err) => {
        if (alive) view.status.textContent = `This drill could not start: ${err.message}`;
      });

      return { destroy() { alive = false; } };
    },
  });

  runcible.registerExercise('piano.staff', {
    mount(host, spec, api) {
      let alive = true;
      const view = frame(host, {
        title: api.t(spec.title) || 'Name the marked note',
        lead: 'Read it from a landmark, not by counting up from middle C. Counting works at rest and fails at tempo.',
        cls: 'pf--staff',
      });
      view.status.textContent = 'Loading the stave.';

      (async () => {
        const props = spec.props || {};
        const pool = await poolFor(api, spec);
        const piece = props.piece ? await api.data(props.piece) : null;
        if (!alive) return;
        if (!pool.length) {
          view.status.textContent = piece
            ? `The reader could follow no bar of ${piece.title}, so there is nothing to ask here.`
            : 'This drill was given no notes to ask about.';
          return;
        }
        const isBar = Boolean(pool[0] && Array.isArray(pool[0].notes));
        let questions;
        if (isBar) {
          const clef = (piece && piece.clef) || 'treble';
          const fifths = piece && Number.isFinite(piece.fifths) ? piece.fifths : 0;
          const time = (piece && piece.time) || null;
          const labels = [...new Set(pool.flatMap((b) => b.notes.map((n) => n.name)))];
          questions = pick(pool, spec.count).map((bar) => {
            const at = Math.floor(Math.random() * bar.notes.length);
            const note = bar.notes[at];
            return {
              itemId: note.id,
              expected: note.name,
              options: optionsFor(note.name, labels),
              after: piece ? `${piece.title}, bar ${bar.n}.` : null,
              prompt: [
                drawBar(bar, { clef, fifths, time, markAt: at }),
                el('p', { class: 'pf-cue', text: 'Name the circled note.' }),
              ],
            };
          });
        } else {
          const labels = [...new Set(pool.map((n) => n.name))];
          questions = pick(pool, spec.count).map((item) => ({
            itemId: item.id,
            expected: item.name,
            options: optionsFor(item.name, labels),
            after: item.cue ? `That is ${item.cue}.` : null,
            prompt: [
              drawNote(item, item.clef || 'treble'),
              el('p', { class: 'pf-cue', text: 'Name the circled note.' }),
            ],
          }));
        }
        const note = isBar && piece
          ? `Every bar here was read out of the engraving of ${piece.title}. `
            + 'The reader drops any bar it cannot follow, so what you were shown is what the score prints.'
          : 'Accidentals are drawn where the score would print one, and the key signature carries the rest.';
        await runQuestions(view, api, spec, questions, note);
      })().catch((err) => {
        if (alive) view.status.textContent = `This drill could not start: ${err.message}`;
      });

      return { destroy() { alive = false; } };
    },
  });
}
