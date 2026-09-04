// jp.lyrics: paste your own lyrics, and read them the way you read the
// public-domain ones.
//
// This is the one place in the Book where copyrighted text is allowed, and the
// rule that makes it allowed is that it never leaves the browser it was typed
// into. PLAN constraint 10: "Paste-your-own lyrics stays in the visitor's
// localStorage, never synced, never shared by URL." So:
//
//   - the store is runcible:lyrics:v1, the key C8.2 reserves for exactly this,
//     written through the Persist kit rather than through a second convention
//   - the Convex schema has no table for it, by design, and nothing here calls
//     anything that could push it
//   - nothing here writes to location, builds a link, or copies to a clipboard
//
// It is never graded either. There is no authority for what a line of somebody
// else's song should say, so every attempt recorded here is correct: null.

import { toRomaji } from '../../../js/vendor/wanakana.js';
import { createStore } from '../../../js/neorgon-persist.js';
import { el, add, clear, button, listeners, frame } from './ui.js';

const store = createStore({ key: 'runcible:lyrics:v1', version: 1 });

function read() {
  const doc = store.load({ items: [] });
  return Array.isArray(doc && doc.items) ? doc.items : [];
}

function write(items) {
  return store.save({ items });
}

function lines(text) {
  return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
}

export default function register(runcible) {
  runcible.registerExercise('jp.lyrics', {
    // Never graded: Today must not offer it as the day's game or count it as a drill.
    graded: false,
    mount(host, spec, api) {
      const bound = listeners();
      let alive = true;
      const view = frame(host, {
        title: api.t(spec.title) || 'Your own lyrics',
        lead: 'Paste a song you are actually listening to. It stays on this device.',
        cls: 'jp--lyrics',
      });

      function notice() {
        return el('p', { class: 'jp-note', text: 'Saved in this browser only. Never put in a link, and not included when you sign in and sync. The Speak button uses the browser\'s own voices, which some browsers fetch from their vendor.' });
      }

      function list() {
        clear(view.body);
        clear(view.foot);
        const items = read();
        view.status.textContent = items.length ? `${items.length} saved` : 'Nothing saved yet';

        const title = el('input', { type: 'text', class: 'rx-input', 'aria-label': 'Title', placeholder: 'Title' });
        const text = el('textarea', { class: 'rx-input jp-textarea', rows: '8', 'aria-label': 'Lyrics, one line per line' });
        const form = el('form', { class: 'jp-form' });
        add(form, [title, text, el('button', { type: 'submit', class: 'btn btn--primary', text: 'Save' })]);
        bound.on(form, 'submit', (e) => {
          e.preventDefault();
          const body = text.value.trim();
          if (!body) { text.focus(); return; }
          const next = read();
          next.unshift({
            id: `own:${Date.now().toString(36)}`,
            title: title.value.trim() || 'Untitled',
            text: body,
            at: Date.now(),
          });
          if (!write(next)) {
            add(view.body, el('p', { class: 'rx-error', text: 'The browser refused to save that. Storage may be full or turned off.' }));
            return;
          }
          list();
        });

        add(view.body, [
          form,
          notice(),
          el('ul', { class: 'jp-saved' }, items.map((item) => el('li', {}, [
            el('span', { class: 'jp-saved-title', text: item.title }),
            button('Open', () => show(item), 'btn btn--secondary btn--sm'),
            button('Delete', () => {
              write(read().filter((x) => x.id !== item.id));
              list();
            }, 'btn btn--ghost btn--sm'),
          ]))),
        ]);
      }

      function show(item) {
        clear(view.body);
        clear(view.foot);
        view.status.textContent = item.title;
        const trouble = el('p', { class: 'jp-note' });
        const rows = lines(item.text);
        add(view.body, [
          el('ol', { class: 'jp-lines' }, rows.map((line, i) => el('li', { class: 'jp-line' }, [
            el('p', { class: 'jp-kana', lang: 'ja', text: line }),
            el('p', { class: 'jp-romaji', text: toRomaji(line) }),
            button('Speak', () => {
              Promise.resolve(api.tts(line)).then((ok) => {
                if (alive && !ok) trouble.textContent = 'This browser has no Japanese voice, so there is no audio.';
              });
              api.attempt({ itemId: `${item.id}:l${i + 1}`, skill: spec.skill, correct: null, ms: 0 });
            }, 'btn btn--ghost btn--sm'),
          ]))),
          el('p', { class: 'jp-note', text: 'The romaji is transliterated in your browser from what you pasted. It is not a translation and nobody checked it.' }),
          trouble,
          notice(),
        ]);
        add(view.foot, [
          button('Back to the list', () => list(), 'btn btn--ghost'),
          button('Done', () => api.done({ graded: false }), 'btn btn--primary'),
        ]);
      }

      list();

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
