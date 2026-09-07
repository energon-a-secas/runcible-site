// ── match ────────────────────────────────────────────────────
// C2.1: two shuffled columns, pair them. Graded.
// Required spec fields: items, left, right, n. Optional: reveal.
//
// One attempt per pairing action, keyed on the left item, so a learner who
// pairs wrongly and then correctly leaves two honest records rather than one
// flattering one. ms runs from selecting the left side to committing the pair.
//
// The board is [prompts] [answers], the verdict sits above it (never under a
// floating button on a phone), and a pair that locks leaves the columns for a
// Paired list underneath, so the board shrinks toward the pairs still open.
//
// `reveal` names a third field, shown only after a pair locks. It exists
// because a pairing drill is worthless when the answer column restates the
// prompt: "risk, ending in k" beside "u, so risuku" can be paired by reading.
// The answer column must carry the answer alone and the sentence that explains
// it belongs to the Paired line.
//
// A Book that welded the two into one field and declared no `reveal` used to be
// served as authored, with a console warning no learner ever sees. It is now
// split here instead, on the narrowest terms that can be right: only when a
// prompt's own word is provably readable out of its answer, only when every
// answer in the drill breaks at the same clause mark, and only when the split
// actually removes the leak. A drill that is authored properly can never meet
// the first condition, so nothing well-made is touched. The warning stays, now
// addressed to whoever can declare the field.

import { createSession } from '../session.js';
import { el, append, button, clear, focus } from '../dom.js';
import { roving } from '../ask.js';
import { explainWrong } from '../feedback.js';
import { resolveList, pickItems, fieldValue, displayValue, itemIdOf, shuffle } from '../items.js';

const warned = new Set();

/** The clause marks a welded field breaks at. A space alone is not one. */
const CLAUSE = /[,;:(\u2013\u2014]/;

/**
 * The prompt's own word, when the answer repeats it. Words of three letters or
 * more only: "me" inside "Mercury" is a coincidence, "robot" inside "robotto"
 * is the exercise answering itself.
 */
function leakedWord(left, right) {
  const first = String(left).toLowerCase().split(/[^\p{L}\p{N}]+/u).find((w) => w.length >= 3);
  return first && String(right).toLowerCase().includes(first) ? first : '';
}

/**
 * The `reveal` a Book should have declared, derived from a column that is
 * leaking. Returns one { head, tail } per pair, or null to leave the drill
 * exactly as authored.
 *
 * Every condition here exists to make the null the usual answer. Nothing
 * happens unless an answer repeats its prompt; the split has to be uniform, so
 * every answer must break at the same mark and leave words on both sides of it,
 * because a column where half the answers were cut and half were not is a
 * worse question than the one it replaced; and the cut must remove the leak,
 * not move it.
 */
function deriveReveal(pairs) {
  if (!pairs.some((p) => leakedWord(p.left, p.right))) return null;
  const cut = [];
  for (const p of pairs) {
    const m = CLAUSE.exec(p.right);
    if (!m) return null;
    const head = p.right.slice(0, m.index).trim();
    const tail = p.right.slice(m.index + 1).trim();
    if (!head || !tail) return null;
    if (cut.length && cut[0].sep !== m[0]) return null;
    cut.push({ head, tail, sep: m[0] });
  }
  if (cut.some((c, i) => leakedWord(pairs[i].left, c.head))) return null;
  return cut;
}

/**
 * Say so on the console when an answer restates its own prompt, whether or not
 * the split above rescued the drill: the field belongs in the Book, and the
 * only person who can put it there is not looking at the page.
 */
function warnLeak(spec, pairs, split) {
  if (warned.has(spec.id)) return;
  const leaks = pairs.filter((p) => leakedWord(p.left, p.right));
  if (leaks.length === 0) return;
  warned.add(spec.id);
  console.warn(
    `[runcible] match "${spec.id}": the "${spec.right}" column repeats the "${spec.left}" column ` +
    `on ${leaks.length} of ${pairs.length} pairs, so those could be paired by reading rather than by knowing. ` +
    (split
      ? 'The column has been split at its own clause mark and the rest moved to the Paired line. '
      : '') +
    'Put the answer alone in "right" and move the rest to a field named by "reveal".',
    leaks.map((p) => `${p.left} / ${p.right}`));
}

export function mount(host, spec, api, ctx) {
  const session = createSession(host, spec, api, ctx, { progress: false, feedbackAbove: true });
  let alive = true;

  (async () => {
    const pool = await resolveList(spec.items, api, ctx, spec, 'items');
    const size = Number.isFinite(spec.n) ? spec.n : spec.count;
    const chosen = pickItems(pool, size);

    const pairs = chosen.map((item, i) => ({
      key: `p${i}`,
      item,
      itemId: itemIdOf(item, spec, spec.left, i),
      left: displayValue(fieldValue(item, spec.left)),
      right: displayValue(fieldValue(item, spec.right)),
      reveal: spec.reveal ? displayValue(fieldValue(item, spec.reveal)) : '',
    }));
    // The Book's own `reveal` always wins; this only fills in a missing one.
    const split = spec.reveal ? null : deriveReveal(pairs);
    warnLeak(spec, pairs, !!split);
    if (split) pairs.forEach((p, i) => { p.right = split[i].head; p.reveal = split[i].tail; });

    clear(session.stage);
    const grid = el('div', { class: 'rx-match' });
    const leftCol = el('ul', { class: 'rx-col rx-col--left', role: 'list' });
    const rightCol = el('ul', { class: 'rx-col rx-col--right', role: 'list' });
    const promptTitle = el('h4', { class: 'rx-col-title', text: session.s('promptColumn') });
    const answerTitle = el('h4', { class: 'rx-col-title', text: session.s('answerColumn') });
    append(grid, [
      el('div', { class: 'rx-col-wrap' }, [promptTitle, leftCol]),
      el('div', { class: 'rx-col-wrap' }, [answerTitle, rightCol]),
    ]);
    leftCol.setAttribute('aria-labelledby', idFor(promptTitle, spec, 'prompts'));
    rightCol.setAttribute('aria-labelledby', idFor(answerTitle, spec, 'answers'));

    const pairedList = el('ul', { class: 'rx-paired-list', role: 'list' });
    const paired = el('div', { class: 'rx-paired', hidden: true }, [
      el('h4', { class: 'rx-col-title', text: session.s('paired') }),
      pairedList,
    ]);
    append(session.stage, [grid, paired]);
    // The live region opens holding the instruction, so the line above the
    // board is never empty and never appears from nowhere: the first pairing
    // replaces "pick one from each column" with what that pairing did.
    session.say(session.s('pairThem'));

    const leftButtons = new Map();
    const rightButtons = new Map();
    let selected = null;
    let selectedAt = 0;
    let remaining = pairs.length;

    const openLeft = () => pairs.map((p) => leftButtons.get(p.key)).filter((b) => b && b.isConnected);
    const openRight = () => pairs.map((p) => rightButtons.get(p.key)).filter((b) => b && b.isConnected);

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
      if (!b || !b.isConnected) return;
      if (selected && selected.key === pair.key) { clearSelection(); session.say(session.s('selectionCleared')); return; }
      clearSelection();
      selected = pair;
      selectedAt = performance.now();
      b.setAttribute('aria-pressed', 'true');
      session.say(session.s('selected', { left: pair.left }));
      focus(openRight()[0]);
    };

    /**
     * Lock a solved pair: it leaves the columns and joins the list beneath.
     * The answer button taken off the board is the one the learner pressed,
     * which is not always this pair's own: splitting a welded column can leave
     * two answers reading the same word, and those are one answer.
     */
    const lock = (pair, pressed = pair) => {
      const lb = leftButtons.get(pair.key);
      const rb = rightButtons.get(pressed.key);
      for (const b of [lb, rb]) if (b && b.parentNode) b.parentNode.remove();
      paired.hidden = false;
      pairedList.appendChild(el('li', {}, [
        el('span', { class: 'rx-paired-mark', 'aria-hidden': 'true', text: '✓' }),
        el('span', { text: session.s('pairedAs', { left: pair.left, right: pair.right }) }),
        // An explicit space, so the line reads as two things to a screen
        // reader as well as to the eye, where the flex gap does the work.
        pair.reveal ? ' ' : null,
        pair.reveal ? el('span', { class: 'rx-paired-reveal', text: pair.reveal }) : null,
      ]));
    };

    const pickRight = (pair) => {
      if (!alive) return;
      const rb = rightButtons.get(pair.key);
      if (!rb || !rb.isConnected) return;
      if (!selected) { session.say(session.s('pickLeftFirst')); focus(openLeft()[0]); return; }
      const chosenPair = selected;
      const ms = performance.now() - selectedAt;
      // By what the button says, not by which button it is. Two answers that
      // read the same are indistinguishable to the learner, so marking one of
      // them wrong would be marking the drill's own duplication wrong.
      const correct = chosenPair.key === pair.key || chosenPair.right === pair.right;
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
        remaining -= 1;
        lock(chosenPair, pair);
        session.say(
          remaining === 0
            ? session.s('goesWith', { left: chosenPair.left, right: chosenPair.right })
            : `${session.s('goesWith', { left: chosenPair.left, right: chosenPair.right })} ${session.s('pairsLeft', { n: remaining })}`,
          'correct',
        );
        if (remaining === 0) { session.finish(); return; }
        focus(openLeft()[0]);
      } else {
        session.say(session.s('doesNotGoWith', { left: chosenPair.left, right: pair.right }), 'wrong');
        explainWrong(session, {
          spec, ctx, api,
          item: chosenPair.item,
          chosen: pair.right,
          expected: chosenPair.right,
          promptValue: chosenPair.left,
          pool,
          promptField: spec.left,
          answerField: spec.right,
          traceKey: 'chosenPairs',
        });
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

    leftCol.addEventListener('keydown', (e) => roving(e, openLeft()));
    rightCol.addEventListener('keydown', (e) => roving(e, openRight()));
    session.on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && selected) { e.preventDefault(); clearSelection(); session.say(session.s('selectionCleared')); }
    });

    focus(openLeft()[0]);
  })().catch((err) => { if (alive) session.fail(err); });

  return { destroy() { alive = false; session.destroy(); } };
}

/** A stable id for a column heading, so its list can point at it. */
function idFor(node, spec, suffix) {
  const id = `rx-${String(spec.id || 'match').replace(/[^\w-]/g, '')}-${suffix}`;
  node.id = id;
  return id;
}
