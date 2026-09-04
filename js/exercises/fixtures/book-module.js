// ── A fixture Book module ────────────────────────────────────
// Exactly the shape C2.2 shows: one default exported function receiving the
// frozen runcible object. It registers one transform and one custom exercise,
// and the fixture manifest below declares both, so the registry's C1 rule 4
// assertion has something real to hold it to.
//
// This is the only place in this directory where the "a Book supplied module"
// half of C2 is exercised. Everything it uses comes through the arguments; it
// imports nothing from the shell and cannot reach the registry.

export default function register(runcible) {
  // C2.4: the shell ships no transforms. This is what a Book adding one looks
  // like. Upper casing is deliberately dull: the point is that it runs on every
  // keystroke and the input shows the converted form, which is the same
  // mechanism an IME style kana transform needs.
  runcible.registerTransform('demo.upper', (raw) => String(raw).toUpperCase());

  runcible.registerExercise('demo.reveal', {
    mount(host, spec, api) {
      const props = spec.props || {};
      let alive = true;
      let handles = [];

      const root = document.createElement('section');
      root.className = 'rx rx--custom';
      const title = document.createElement('h3');
      title.className = 'rx-title section__title';
      title.textContent = api.t(spec.title) || 'Reveal';
      const cue = document.createElement('p');
      cue.className = 'rx-cue';
      const back = document.createElement('p');
      back.className = 'rx-para';
      const bar = document.createElement('div');
      bar.className = 'toolbar';
      root.append(title, cue, back, bar);
      host.replaceChildren(root);

      const btn = (label, onClick, cls) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `btn ${cls}`;
        b.textContent = label;
        b.addEventListener('click', onClick);
        handles.push([b, onClick]);
        return b;
      };

      (async () => {
        const list = await api.data(props.items);
        if (!alive) return;
        const picked = list.slice(0, Number(props.count) || list.length);
        let i = 0;
        let shownAt = performance.now();

        const draw = () => {
          const item = picked[i];
          cue.textContent = item[props.front];
          back.textContent = '';
          bar.replaceChildren(
            btn('Show', () => { back.textContent = item[props.back]; }, 'btn--secondary'),
            btn('Got it', () => score(true), 'btn--primary'),
            btn('Missed it', () => score(false), 'btn--ghost'),
          );
          shownAt = performance.now();
          bar.firstChild.focus();
        };

        const score = (correct) => {
          const item = picked[i];
          // The same call every generic type makes. C2.3 is the whole surface a
          // Book needs to become evidence for a chapter goal.
          api.attempt({
            itemId: `${spec.itemIdPrefix ? spec.itemIdPrefix + ':' : ''}${item.id}`,
            skill: spec.skill,
            correct,
            ms: performance.now() - shownAt,
            answer: correct ? item[props.back] : '',
            expected: item[props.back],
            hintUsed: false,
          });
          i += 1;
          if (i >= picked.length) {
            cue.textContent = 'Done.';
            back.textContent = '';
            bar.replaceChildren(btn('Continue', () => api.done(), 'btn--primary'));
            bar.firstChild.focus();
            return;
          }
          draw();
        };

        draw();
      })();

      return {
        destroy() {
          alive = false;
          for (const [b, fn] of handles) b.removeEventListener('click', fn);
          handles = [];
          host.replaceChildren();
        },
      };
    },
  });
}

/** What a book.json modules[] entry would declare for this file (C1 rule 4). */
export const PROVIDES = {
  exercises: ['demo.reveal'],
  transforms: ['demo.upper'],
};
