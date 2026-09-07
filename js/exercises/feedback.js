// ── Feedback after a wrong answer ────────────────────────────
// A panel under the verdict, inside the session's live region: what was
// chosen (struck), what was right (large), and one sentence of why. The why
// comes from the item and the spec, in this order (DESIGN-BOOK, "Feedback
// after a wrong answer"):
//
//   item.explain            {en,es} or a string
//   item.rule / item.rules  a rule id, or a list of them, resolved against
//                           chapter.rules[<id>] (ctx.chapter or ctx.rules, the
//                           shape { title, text, examples[], page }) and then
//                           against spec.props.rules, a pointer or a list whose
//                           rows carry { id, rule, examples_text }, the shape
//                           data/loanwords/rules.json already has
//   item.confusables, or spec.confusables (pointer or list), or a `confusables`
//                           fragment in the same document the items came from
//                           strings, or { glyphs[], tell } rows; the row that
//                           holds the prompt gives the tell
//   the pool                what the learner actually picked, named by the
//                           spec's own prompt field: "What you picked, ki,
//                           belongs to き". Derived, never authored, so it is
//                           only offered when exactly one item carries that
//                           answer; two items sharing it would name the wrong
//                           one with a straight face
//   nothing                 the panel stops after the answer. It does not say
//                           that it has nothing to say: a note apologising for
//                           the book, inside the book, on every miss of an item
//                           that was never going to carry a reason
//
// A rule that names a page gets a link. The engine cannot reach the prose, so
// the link dispatches `rx-see-rule` ({ ruleId, pageId }) on the exercise root
// for the shell to handle; when nothing handles it, it scrolls to `#page-<id>`
// or `[data-page-id]` and marks it `data-rx-echo` for two seconds.
//
// Nothing here is subject specific. Field names are read, never interpreted.

import { el, button } from './dom.js';
import { fieldValue, displayValue } from './items.js';

/** spec -> Promise<Map<id, rule>>, so a pointer is fetched once per exercise. */
const ruleCache = new WeakMap();

/**
 * Explain a wrong answer. Line 1 lands at once; line 2 may wait on a data
 * pointer and is appended when it resolves, if the panel is still on the page.
 *
 * @param {object} session
 * @param {object} q {
 *   spec, ctx, api, item,
 *   chosen, expected      what was picked and what was right, as shown
 *   promptValue           the item's prompt as shown, for confusables
 *   pool, promptField, answerField   lets the wrong option be traced to its
 *                         own item, so "not き" names the glyph, not "ki"
 * }
 * @returns {HTMLElement} the panel, already given to session.explain()
 */
export function explainWrong(session, q) {
  const panel = el('div', { class: 'rx-explain' });
  if (q.chosen) {
    panel.appendChild(el('p', { class: 'rx-explain-line' }, [
      el('span', { class: 'rx-explain-k', text: session.s('yourAnswer') }),
      ' ',
      el('s', { class: 'rx-explain-struck', text: q.chosen }),
    ]));
  }
  panel.appendChild(el('p', { class: 'rx-explain-line' }, [
    el('span', { class: 'rx-explain-k', text: session.s('rightAnswer') }),
      ' ',
    el('strong', { class: 'rx-explain-answer', text: q.expected }),
  ]));
  session.explain(panel);

  whyFor(session, q).then((why) => {
    if (!panel.isConnected) return;
    if (why && why.text) {
      panel.appendChild(el('p', { class: 'rx-explain-why' }, [
        el('span', { class: 'rx-explain-k', text: session.s('because') }),
      ' ',
        why.text,
      ]));
      if (why.page) panel.appendChild(seeRuleLink(session, why));
    }
    // An item with nothing to say shows lines 1 and 2 and stops. The panel used
    // to print "This item carries no explanation yet." under every typed miss,
    // which is the software apologising for the book inside the book.
  }).catch((err) => {
    console.error('[runcible] feedback lookup failed', err);
  });
  return panel;
}

/**
 * After a right answer that had more than one accepted spelling, say so.
 * @param {object} session
 * @param {{ expectedRaw: * }} q the raw expected value, an array when `accept` lists several
 * @returns {HTMLElement|null}
 */
export function explainRight(session, q) {
  const raw = q.expectedRaw;
  if (!Array.isArray(raw) || raw.filter((v) => v !== null && v !== undefined && v !== '').length < 2) return null;
  const panel = el('div', { class: 'rx-explain' }, [
    el('p', { class: 'rx-explain-why', text: session.s('bothRight') }),
  ]);
  session.explain(panel);
  return panel;
}

async function whyFor(session, q) {
  const item = q.item && typeof q.item === 'object' ? q.item : {};
  const explain = session.t(item.explain);
  if (explain) return { text: explain, page: item.page || null };

  const ids = ruleIds(item);
  if (ids.length) {
    const rules = await rulesFor(q.spec || {}, q.ctx || {}, q.api || {});
    for (const id of ids) {
      const r = rules.get(id);
      if (!r) continue;
      const text = ruleText(session, r);
      if (text) return { text, page: r.page || null, ruleId: id };
    }
  }

  const tell = await confusableText(session, q, item);
  if (tell) return { text: tell };

  const trace = tracedPick(session, q);
  if (trace) return { text: trace };
  return null;
}

/**
 * Name what the learner actually picked, in the spec's own terms. The chosen
 * label is an answer belonging to some item in the pool; showing that item's
 * prompt turns "wrong" into "you read the other one".
 */
function tracedPick(session, q) {
  const owner = ownerOfChosen(q);
  if (!owner) return '';
  const prompt = displayValue(fieldValue(owner, q.promptField));
  if (!prompt || prompt === q.promptValue) return '';
  // A pairing board reads better as "X goes with Y" than as "you picked X,
  // which is Y", so the caller may name the sentence it wants.
  return session.s(q.traceKey === 'chosenPairs' ? 'chosenPairs' : 'chosenIs', { answer: q.chosen, prompt });
}

function ruleIds(item) {
  const out = [];
  for (const v of [item.rule, item.rules]) {
    if (typeof v === 'string' && v) out.push(v);
    else if (Array.isArray(v)) for (const x of v) if (x !== null && x !== undefined && x !== '') out.push(String(x));
  }
  return out;
}

/** Every rule this exercise can see, keyed by id. */
function rulesFor(spec, ctx, api) {
  if (ruleCache.has(spec)) return ruleCache.get(spec);
  const p = (async () => {
    const map = new Map();
    const chapter = ctx.chapter && typeof ctx.chapter === 'object' ? ctx.chapter : null;
    addRules(map, (chapter && chapter.rules) || ctx.rules || spec.rules);
    const listed = spec.props && spec.props.rules;
    if (listed !== undefined && listed !== null) {
      if (typeof listed === 'string') {
        if (typeof api.data === 'function') addRules(map, await api.data(listed));
      } else addRules(map, listed);
    }
    return map;
  })();
  ruleCache.set(spec, p);
  return p;
}

function addRules(map, value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const r of value) {
      if (r && typeof r === 'object' && r.id !== undefined && !map.has(String(r.id))) map.set(String(r.id), r);
    }
    return;
  }
  for (const id of Object.keys(value)) if (!map.has(id)) map.set(id, value[id]);
}

/** One sentence from a rule row, whichever of the two shapes it has. */
function ruleText(session, r) {
  if (!r || typeof r !== 'object') return '';
  const t = session.t;
  const title = t(r.title);
  const text = t(r.text) || (typeof r.rule === 'string' ? r.rule : '');
  const parts = [];
  if (title && text) parts.push(`${title}: ${text}`);
  else if (title || text) parts.push(title || text);
  if (typeof r.examples_text === 'string' && r.examples_text) {
    parts.push(r.examples_text.replace(/\*/g, ''));
  } else if (Array.isArray(r.examples)) {
    const ex = r.examples.map((e) => (typeof e === 'string' ? e : t(e))).filter(Boolean);
    if (ex.length) parts.push(ex.join('; '));
  }
  return sentences(parts);
}

/**
 * Join fragments as sentences without doubling a full stop the author wrote,
 * and finish the last one. A tell like "き has two crossbars, さ has one" is
 * written as a phrase, and left unterminated it reads as a line that was cut.
 */
function sentences(parts) {
  let out = '';
  for (const p of parts) {
    const s = String(p).trim();
    if (!s) continue;
    if (!out) { out = s; continue; }
    out += (/[.!?。]$/.test(out) ? ' ' : '. ') + s;
  }
  return out && !/[.!?。]$/.test(out) ? `${out}.` : out;
}

/** The confusable entry that holds this prompt, rendered as notThis plus its tell. */
async function confusableText(session, q, item) {
  let entries = item.confusables;
  const spec = q.spec || {};
  if (entries === undefined && spec.confusables !== undefined && spec.confusables !== null) {
    entries = spec.confusables;
    if (typeof entries === 'string') {
      if (!q.api || typeof q.api.data !== 'function') return '';
      entries = await q.api.data(entries);
    }
  }
  if (entries === undefined) entries = await siblingConfusables(spec, q.api);
  if (!Array.isArray(entries) || entries.length === 0) return '';

  const me = q.promptValue === undefined || q.promptValue === null ? '' : String(q.promptValue);
  const other = wrongPromptOf(q);

  if (entries.every((e) => typeof e === 'string')) {
    const wrong = (other && entries.includes(other)) ? other
      : (q.chosen && entries.includes(q.chosen)) ? q.chosen
        : entries.find((e) => e !== me) || '';
    return wrong ? session.s('notThis', { wrong }) : '';
  }

  const rows = entries.filter((e) => e && Array.isArray(e.glyphs) && (!me || e.glyphs.map(String).includes(me)));
  const pick = rows.find((e) => other && e.glyphs.map(String).includes(other)) || rows[0];
  if (!pick) return '';
  const glyphs = pick.glyphs.map(String);
  const wrong = other && glyphs.includes(other) ? other : (glyphs.find((g) => g !== me) || '');
  const tell = session.t(pick.tell);
  return sentences([wrong ? session.s('notThis', { wrong }) : '', tell]);
}

/**
 * The one item whose answer field holds what was chosen. Ambiguity disqualifies
 * it: when three items share the answer "3", naming the first one would be a
 * true sentence about the wrong word.
 */
function ownerOfChosen(q) {
  if (!Array.isArray(q.pool) || !q.answerField || !q.promptField || !q.chosen) return null;
  const hits = q.pool.filter((o) => displayValue(fieldValue(o, q.answerField)) === q.chosen);
  return hits.length === 1 ? hits[0] : null;
}

/** The prompt of the item whose answer was chosen, so a wrong glyph can be named. */
function wrongPromptOf(q) {
  const owner = ownerOfChosen(q);
  return owner ? displayValue(fieldValue(owner, q.promptField)) : '';
}

/**
 * The document an exercise's items came from may already carry a `confusables`
 * list beside them: data/kana/*.json does. When the spec names no source, ask
 * for that same document's `confusables` fragment.
 *
 * The path is the one the spec already used, so the chapter has declared it and
 * the shell's C1 rule 2 check passes for free. A miss is not an error: a
 * document with no such fragment is the normal case, so it resolves to nothing
 * and the next source in the order gets its turn.
 */
const siblingCache = new WeakMap();

function siblingConfusables(spec, api) {
  if (siblingCache.has(spec)) return siblingCache.get(spec);
  const p = (async () => {
    const src = spec.items;
    if (typeof src !== 'string' || !src.includes('#')) return null;
    if (!api || typeof api.data !== 'function') return null;
    const path = src.split('#')[0];
    try {
      const got = await api.data(`${path}#confusables`);
      return Array.isArray(got) ? got : null;
    } catch {
      return null;
    }
  })();
  siblingCache.set(spec, p);
  return p;
}

function seeRuleLink(session, why) {
  const pageId = String(why.page);
  const go = () => {
    const ev = new CustomEvent('rx-see-rule', {
      bubbles: true, cancelable: true, detail: { ruleId: why.ruleId || null, pageId },
    });
    if (!session.root.dispatchEvent(ev)) return;
    const target = document.getElementById(`page-${pageId}`)
      || document.querySelector(`[data-page-id="${CSS.escape(pageId)}"]`);
    if (!target) return;
    const still = document.documentElement.hasAttribute('data-reduce-motion')
      || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    target.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
    target.setAttribute('data-rx-echo', '');
    setTimeout(() => target.removeAttribute('data-rx-echo'), 2000);
  };
  return el('p', { class: 'rx-explain-line' }, [
    button(session.s('seeRule'), go, { class: 'rx-link' }),
  ]);
}
