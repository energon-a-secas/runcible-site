// ── match ────────────────────────────────────────────────────
// C2.1: two shuffled columns, pair them. Graded.
// Required spec fields: items, left, right, n.
//
// One attempt per pairing action, keyed on the left item, so a learner who
// pairs wrongly and then correctly leaves two honest records rather than one
// flattering one. ms runs from selecting the left side to committing the pair.

import { createSession } from '../session.js';
import { el, append, button, clear, focus } from '../dom.js';
import { resolveList, pickItems, fieldValue, displayValue, itemIdOf, shuffle } from '../items.js';

export function mount(host, spec, api, ctx) {
  const session = createSession(host, spec, api, ctx, { progress: false });
  let alive = true;

  (async () => {
    const pool = await resolveList(spec.items, api, ctx, spec, 'items');
    const size = Number.isFinite(spec.n) ? spec.n : spec.count;
    const chosen = pickItems(pool, size);

    const pairs = chosen.map((item, i) => ({
      key: `p${i}`,
      itemId: itemIdOf(item, spec, spec.left, i),
      left: displayValue(fieldValue(item, spec.left)),
      right: displayValue(fieldValue(item, spec.right)),
    }));

    clear(session.stage);
    const grid = el('div', { class: 'rx-match' });
    const leftCol = el('ul', { class: 'rx-col rx-col--left', role: 'list', 'aria-label': session.s('leftColumn') });
    const rightCol = el('ul', { class: 'rx-col rx-col--right', role: 'list', 'aria-label': session.s('rightColumn') });
    append(grid, [leftCol, rightCol]);
    append(session.stage, [
      el('p', { class: 'rx-cue', text: session.s('pairThem') }),
      grid,
    ]);

    const leftButtons = new Map();
    const rightButtons = new Map();
    let selected = null;
    let selectedAt = 0;
    let remaining = pairs.length;

    const clearSelection = () => {
      if (selected) {
        const b = leftButtons.get(selected.key);
        if (b) b.setAttribute('aria-pressed', 'false');
      }
      selected = null;
    };

    const pickLeft = (pair) => {
      if (!alive) return;
      const b = leftButtons.get(pair.key);
      if (!b || b.disabled) return;
      if (selected && selected.key === pair.key) { clearSelection(); return; }
      clearSelection();
      selected = pair;
      selectedAt = performance.now();
      b.setAttribute('aria-pressed', 'true');
      session.say(session.s('selected', { left: pair.left }));
    };

    const pickRight = (pair) => {
      if (!alive) return;
      const rb = rightButtons.get(pair.key);
      if (!rb || rb.disabled) return;
      if (!selected) { session.say(session.s('pickLeftFirst')); focus(leftButtons.get(pairs[0].key)); return; }
      const chosenPair = selected;
      const ms = performance.now() - selectedAt;
      const correct = chosenPair.key === pair.key;
      session.record({
        itemId: chosenPair.itemId,
        correct,
        ms,
        answer: pair.right,
        expected: chosenPair.right,
        hintUsed: false,
      });
      const lb = leftButtons.get(chosenPair.key);
      clearSelection();
      if (correct) {
        lb.disabled = true; lb.dataset.state = 'correct';
        rb.disabled = true; rb.dataset.state = 'correct';
        remaining -= 1;
        session.say(session.s('goesWith', { left: chosenPair.left, right: chosenPair.right }));
        if (remaining === 0) { session.finish(); return; }
        const nextOpen = pairs.find((p) => !leftButtons.get(p.key).disabled);
        if (nextOpen) focus(leftButtons.get(nextOpen.key));
      } else {
        session.say(session.s('doesNotGoWith', { left: chosenPair.left, right: pair.right }));
        focus(lb);
      }
    };

    for (const pair of shuffle(pairs)) {
      const b = button(pair.left, () => pickLeft(pair), { class: 'btn btn--secondary rx-pair' });
      b.setAttribute('aria-pressed', 'false');
      leftButtons.set(pair.key, b);
      leftCol.appendChild(el('li', {}, [b]));
    }
    for (const pair of shuffle(pairs)) {
      const b = button(pair.right, () => pickRight(pair), { class: 'btn btn--secondary rx-pair' });
      rightButtons.set(pair.key, b);
      rightCol.appendChild(el('li', {}, [b]));
    }

    session.on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && selected) { e.preventDefault(); clearSelection(); session.say(session.s('selectionCleared')); }
    });

    focus(leftCol.querySelector('button'));
  })().catch((err) => { if (alive) session.fail(err); });

  return { destroy() { alive = false; session.destroy(); } };
}
