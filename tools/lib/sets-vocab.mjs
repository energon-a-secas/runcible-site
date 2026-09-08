/**
 * Quiz sets, the vocab pairs game: a word on the left, one meaning on the
 * right, built from a data/vocab slice. The reading is never on the board.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. See tools/build-sets.mjs.
 *
 * The corpus is a JMdict slice and carries English only. The Spanish is
 * written in tools/selection/sets.json (meanings_es) against the meaning the
 * pair actually shows and is carried across as it stands: this file translates
 * nothing, and a word the selection does not name ships with es null so the
 * board prints the English and the honesty line says so.
 */
import { LICENCES, hasBannedDash, licenceBlock } from './corpus.mjs';
import { TOOL, readData, skip } from './sets-common.mjs';

/** trim, casefold, strip accents: the contract's folding for a pairs board. */
export function fold(s) {
  return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/** Drop every (...) group, nested ones included, and tidy the spaces. */
function stripParens(s) {
  let out = s;
  let prev;
  do { prev = out; out = out.replace(/\([^()]*\)/g, ''); } while (out !== prev);
  return out.replace(/\s+/g, ' ').replace(/\s+([,;.])/g, '$1').trim();
}

/**
 * Cut a JMdict sense on its ";" separators, but never on one inside brackets.
 * A plain split() on ";" cuts "please (give me; do for me)" into "please (give
 * me" and "do for me)", and the first of those is what the board would print:
 * a meaning with an unclosed bracket, which stripParens cannot repair because
 * there is nothing left to match. Two entries in the corpus hit it today,
 * JMdict 1430230 and 1550770, and neither is in a shipped set before this
 * change, so no existing item id or meaning moves.
 */
function splitSense(sense) {
  const out = [];
  let depth = 0;
  let buf = '';
  for (const ch of sense) {
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf);
  return out;
}

/**
 * The meanings a JMdict entry offers, shortest first: each sense split on
 * ";", the parenthetical stripped, then the same segment with it kept. The
 * first one that is unique on the board and does not contain the word wins.
 */
function meaningCandidates(gloss) {
  const out = [];
  for (const sense of gloss) {
    for (const seg of splitSense(sense)) {
      const full = seg.trim();
      const bare = stripParens(full);
      if (bare && !out.includes(bare)) out.push(bare);
      if (full && full !== bare && !out.includes(full)) out.push(full);
    }
  }
  return out;
}

/**
 * The groups of a vocab slice this set is built from.
 *
 * `groups` on a selection row is an allow list, and its default is every group
 * the slice declares. It exists because a pairs board is a set of words that
 * each own a distinct meaning, and one group in this corpus is by design the
 * opposite: `register` in data/vocab/ch11.json is six acts said three ways, so
 * the eighteen words offer six meanings between them. Built whole, that slice
 * loses two words outright and prints "to drink" beside the honorific for eat.
 * The chapter never asks for a register pairs round, so the row names the one
 * group it does ask for and the rest of the slice stays out of the set.
 */
function pairGroups(spec, src) {
  if (!Array.isArray(spec.groups)) return src.order;
  for (const g of spec.groups) {
    if (!src.groups[g]) throw new Error(`${spec.id}: groups names ${g}, which data/${spec.from} does not carry`);
  }
  return src.order.filter((g) => spec.groups.includes(g));
}

export function vocabPairsSet(spec) {
  const src = readData(spec.from);
  const meanings = spec.meanings_es || {};
  const pins = spec.meanings_en || {};
  const items = [];
  const rights = new Set();
  const missing = [];
  const used = new Set();
  const pinsLeft = new Set(Object.keys(pins));
  for (const groupId of pairGroups(spec, src)) {
    for (const w of src.groups[groupId]) {
      const left = w.word;
      const fl = fold(left);
      const offered = meaningCandidates(w.gloss);
      // A pin picks which of the entry's OWN meanings this pair shows, and the
      // assertion is what keeps it a choice rather than an authored gloss: a
      // string the entry does not offer stops the run. It is here because the
      // automatic pick is "shortest first", and the shortest is sometimes the
      // one another word needs more: two expressions in ch14 both reduce to
      // "thank you", and whichever is reached first takes it and drops the
      // other off the board entirely.
      if (pins[w.id] !== undefined) {
        if (!offered.includes(pins[w.id])) {
          throw new Error(`${spec.id}: meanings_en pins "${pins[w.id]}" on ${w.id} ${left}, which is not one of the meanings data/${spec.from} carries for it (${offered.join(' | ')})`);
        }
        pinsLeft.delete(w.id);
      }
      const right = pins[w.id] !== undefined ? pins[w.id] : offered.find((m) => {
        const fr = fold(m);
        return fr && !rights.has(fr) && fr !== fl && !fr.includes(fl) && !fl.includes(fr) && !hasBannedDash(m);
      });
      if (!right) { skip(spec.id, `${w.id} ${left}: every meaning the corpus gives is already on another pair (${w.gloss[0]})`); continue; }
      if (rights.has(fold(right))) {
        throw new Error(`${spec.id}: meanings_en pins "${right}" on ${w.id} ${left}, and another pair already prints it`);
      }
      rights.add(fold(right));
      // The corpus is a JMdict slice and carries English only. The Spanish is
      // the selection file's, written against the meaning this pair actually
      // shows, and a word it does not name ships with es null: the board then
      // prints the English and the honesty line says so.
      const es = typeof meanings[w.id] === 'string' && meanings[w.id].trim() ? meanings[w.id].trim() : null;
      if (!es) missing.push(`${w.id} ${left} (${right})`);
      const item = { id: w.id, left, right: { en: right, es }, group: groupId };
      used.add(groupId);
      // The reading is never on the board (it would give the word away for a
      // kana-only entry and is what a kanji entry is testing). It surfaces in
      // the feedback after a miss, which is what note is for.
      if (w.has_kanji && w.kana && w.kana !== left) item.note = w.kana;
      items.push(item);
    }
  }
  if (missing.length) skip(spec.id, `${missing.length} pairs with no Spanish meaning in tools/selection/sets.json (${missing.join('; ')})`);
  if (pinsLeft.size) {
    throw new Error(`${spec.id}: meanings_en names ${[...pinsLeft].join(', ')}, which data/${spec.from} does not carry in the groups this set builds`);
  }

  // The Spanish board prints es, or the English when es is null, and two pairs
  // that print the same word are one pair the learner cannot answer. A clash
  // drops the Spanish rather than the pair: the English board is unaffected.
  const seen = new Map();
  for (const it of items) {
    const shown = it.right.es || it.right.en;
    const key = fold(shown);
    if (seen.has(key)) {
      skip(spec.id, `${it.id} ${it.left}: the Spanish "${shown}" is already ${seen.get(key)}'s on a Spanish board; dropped to null`);
      it.right.es = null;
    } else seen.set(key, it.id);
    const fl = fold(it.left);
    const fe = it.right.es ? fold(it.right.es) : '';
    if (fe && (fe === fl || fe.includes(fl) || fl.includes(fe))) {
      skip(spec.id, `${it.id} ${it.left}: the Spanish "${it.right.es}" puts the left side on the board; dropped to null`);
      it.right.es = null;
    }
  }

  // The rungs of the chapter are the groups a filtered round names, so the set
  // declares the ones it used and no more, in the corpus's own words.
  const groups = {};
  for (const g of pairGroups(spec, src)) {
    if (!used.has(g)) continue;
    const label = src.labels?.[g];
    if (label) groups[g] = label;
    else skip(spec.id, `group ${g}: data/${spec.from} gives it no label, so a filtered round has no words for its header`);
  }

  const edrdg = LICENCES.edrdg;
  return {
    lang: 'ja',
    licence: { spdx: edrdg.spdx, screen: 'required', attribution: edrdg.acknowledgement, source: edrdg.url },
    _licence: licenceBlock('edrdg', TOOL, {
      chapter: src.chapter,
      note: `Derived from data/${spec.from}, a JMdict slice. left is the headword, right the first JMdict meaning that is unique on the board with the Spanish from tools/selection/sets.json beside it, note the kana reading for a kanji headword, group the rung the word sits in.`,
    }),
    groups,
    items,
    summary: `${items.length} pairs from ${pairGroups(spec, src).reduce((a, g) => a + src.groups[g].length, 0)} words, ${items.filter((i) => i.right.es).length} with Spanish, in ${Object.keys(groups).length} groups`,
  };
}
