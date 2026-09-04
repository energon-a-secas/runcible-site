// jp.song: read a public-domain song, and type its lines back.
//
// Two modes on one module, because they share the whole of the loading half.
//
//   props.mode "read"  a read-along. Kana always. Romaji and gloss are toggles,
//                      off by default, because the point is reading kana and a
//                      romaji line the eye can reach is a romaji line the eye
//                      reads. One speak button per line. Nothing is graded:
//                      every attempt is correct: null.
//   props.mode "type"  a line is shown in romaji with its gloss, and the
//                      learner types it back in kana. Graded.
//
// Copyright is a hard gate here and the data carries the verdicts, not this
// file: data/songs/index.json lists exactly the nineteen songs verified public
// domain in both Japan and the US, each song file carries its per-jurisdiction
// basis and a verses_permitted count, and tools/check-licence.mjs fails the
// build on a twentieth. This module renders what the catalog gives it and never
// hardcodes a title.

import { toHiragana } from '../../../js/vendor/wanakana.js';
import { kanaReader } from './kana-input.js';
import { el, add, clear, button, listeners, shuffle, resolveList, frame, summary } from './ui.js';

/**
 * The same romaji reader the kana transform registers (C12 A16). Live on every
 * keystroke, settled once at submit, before the line is compared.
 */
const hiragana = kanaReader(toHiragana);

/** Kana as typed, with every kind of space removed before comparing. */
function bare(raw) {
  return String(raw || '').replace(/[\s　]+/g, '');
}

/** Flatten a song document into { verse, line, kana, romaji, gloss } rows. */
function linesOf(song) {
  const out = [];
  for (const verse of song.verses || []) {
    const kana = verse.lines || [];
    const romaji = verse.romaji_lines || [];
    kana.forEach((text, i) => {
      out.push({
        id: `song:${song.id}:v${verse.n}:l${i + 1}`,
        verse: verse.n,
        line: i + 1,
        kana: text,
        romaji: romaji[i] || '',
        gloss: verse.gloss || '',
      });
    });
  }
  return out;
}

export default function register(runcible) {
  runcible.registerExercise('jp.song', {
    mount(host, spec, api) {
      const bound = listeners();
      let alive = true;
      const props = spec.props || {};
      const mode = props.mode === 'type' ? 'type' : 'read';
      const view = frame(host, {
        title: api.t(spec.title) || (mode === 'type' ? 'Type the line' : 'Read along'),
        lead: mode === 'type'
          ? 'Type romaji. It turns into hiragana as you go. A lone n needs to be typed twice.'
          : 'Kana is what you are here to read. Romaji and the English are behind the two switches.',
        cls: `jp--song jp--song-${mode}`,
      });

      let catalog = [];
      const loaded = new Map();   // song id to its document
      let showRomaji = false;
      let showGloss = false;

      async function songDoc(row) {
        if (loaded.has(row.id)) return loaded.get(row.id);
        const verses = await api.data(`${row.src}#verses`);
        const doc = { id: row.id, title: row.title, romaji: row.romaji, verses };
        loaded.set(row.id, doc);
        return doc;
      }

      function picker(onPick) {
        return el('div', { class: 'toolbar jp-picker' }, catalog.map((row) => button(
          `${row.title}  ${row.romaji}`,
          () => onPick(row),
          'btn btn--ghost btn--sm',
        )));
      }

      // ---- read mode -------------------------------------------------------

      function speakLine(text, where) {
        Promise.resolve(api.tts(text)).then((ok) => {
          if (!alive || ok) return;
          where.textContent = 'This browser has no Japanese voice, so there is no audio. The kana is still the lesson.';
        });
      }

      function readSong(doc) {
        clear(view.body);
        clear(view.foot);
        view.status.textContent = `${doc.title}  ${doc.romaji}`;
        const trouble = el('p', { class: 'jp-note' });

        const rows = linesOf(doc);
        const list = el('ol', { class: 'jp-lines' });
        for (const row of rows) {
          const romaji = el('p', { class: 'jp-romaji', text: row.romaji, hidden: !showRomaji });
          const play = button('Speak', () => {
            speakLine(row.kana, trouble);
            api.attempt({ itemId: row.id, skill: spec.skill, correct: null, ms: 0 });
          }, 'btn btn--ghost btn--sm');
          add(list, el('li', { class: 'jp-line' }, [
            el('p', { class: 'jp-kana', lang: 'ja', text: row.kana }),
            romaji,
            play,
          ]));
        }

        const glossEl = el('p', { class: 'jp-gloss', hidden: !showGloss });
        const glosses = [...new Set(rows.map((r) => r.gloss).filter(Boolean))];
        glossEl.textContent = glosses.join(' ');

        const toggles = el('div', { class: 'toolbar jp-toggles' }, [
          button(showRomaji ? 'Hide romaji' : 'Show romaji', () => { showRomaji = !showRomaji; readSong(doc); }),
          button(showGloss ? 'Hide the English' : 'Show the English', () => { showGloss = !showGloss; readSong(doc); }),
        ]);

        add(view.body, [
          toggles,
          list,
          glossEl,
          el('p', { class: 'jp-note', text: 'The English is a gloss of the whole verse, not of one line. The research reports it that way and this does not split it up to look tidier.' }),
          trouble,
        ]);
        add(view.foot, [
          button('Another song', () => start(), 'btn btn--ghost'),
          button('Done', () => summary(view, api, { asked: rows.length, right: 0, graded: false }), 'btn btn--primary'),
        ]);
      }

      // ---- type mode -------------------------------------------------------

      let queue = [];
      let at = 0;
      let asked = 0;
      let right = 0;

      function askLine() {
        if (!alive) return;
        if (at >= queue.length) {
          summary(view, api, { asked, right });
          return;
        }
        const row = queue[at];
        const started = performance.now();
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
          'aria-label': 'The line, in kana',
        });
        bound.on(input, 'input', () => {
          const end = input.selectionStart === input.value.length;
          const next = hiragana(input.value);
          if (next === input.value) return;
          input.value = next;
          if (end) input.setSelectionRange(next.length, next.length);
        });

        const form = el('form', { class: 'rx-form toolbar' });
        add(form, [input, el('button', { type: 'submit', class: 'btn btn--primary', text: 'Check' })]);
        const trouble = el('p', { class: 'jp-note' });

        add(view.body, [
          el('p', { class: 'jp-prompt jp-prompt--romaji', text: row.romaji }),
          row.gloss ? el('p', { class: 'jp-gloss', text: row.gloss }) : null,
          form,
          trouble,
        ]);
        add(view.foot, button('Hear it', () => speakLine(row.kana, trouble), 'btn btn--ghost btn--sm'));

        bound.on(form, 'submit', (e) => {
          e.preventDefault();
          const answer = hiragana.settle(input.value);
          if (!bare(answer)) { input.focus(); return; }
          // The romaji prompt says wa and o where the kana writes は and を, so
          // typing what the prompt says is not a miss: either spelling passes.
          const particles = (s) => bare(s).replace(/は/g, 'わ').replace(/を/g, 'お').replace(/へ/g, 'え');
          const correct = bare(answer) === bare(row.kana) || particles(answer) === particles(row.kana);
          asked += 1;
          if (correct) right += 1;
          api.attempt({
            itemId: row.id,
            skill: spec.skill,
            correct,
            ms: Math.round(performance.now() - started),
            answer: bare(answer),
            expected: row.kana,
          });
          clear(view.body);
          clear(view.foot);
          add(view.body, [
            el('p', { class: `jp-verdict jp-verdict--${correct ? 'right' : 'wrong'}`, text: correct ? 'That is the line.' : 'Not quite.' }),
            el('p', { class: 'jp-kana', lang: 'ja', text: row.kana }),
            correct ? null : el('p', { class: 'jp-note', text: `You wrote ${answer}` }),
          ]);
          const go = button(at + 1 >= queue.length ? 'See the score' : 'Next line', () => { at += 1; askLine(); }, 'btn btn--primary');
          view.foot.appendChild(go);
          go.focus();
        });

        input.focus();
      }

      async function typeFrom(rows) {
        queue = shuffle(rows).slice(0, Number.isFinite(spec.count) && spec.count > 0 ? spec.count : rows.length);
        at = 0;
        askLine();
      }

      // ---- entry -----------------------------------------------------------

      function start() {
        clear(view.body);
        clear(view.foot);
        view.status.textContent = `${catalog.length} songs, all of them out of copyright in Japan and in the United States.`;
        add(view.body, picker(async (row) => {
          try {
            const doc = await songDoc(row);
            if (!alive) return;
            if (mode === 'type') typeFrom(linesOf(doc));
            else readSong(doc);
          } catch (err) {
            add(view.body, el('p', { class: 'rx-error', text: `That song did not load: ${err.message}` }));
          }
        }));
      }

      (async () => {
        try {
          const rows = await resolveList(api, spec.items, 'items');
          const only = Array.isArray(props.songs) ? new Set(props.songs) : null;
          catalog = rows.filter((row) => row && row.src && (!only || only.has(row.id)));
          if (!alive) return;
          if (!catalog.length) {
            view.status.textContent = 'The song catalog resolved to nothing, so there is nothing to read.';
            return;
          }
          start();
        } catch (err) {
          if (!alive) return;
          add(view.body, el('p', { class: 'rx-error', text: `The song catalog did not load: ${err.message}` }));
          console.error('[japanese] jp.song', err);
        }
      })();

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
