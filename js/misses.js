// "Your misses": a wrong answer in a round becomes a card in a personal deck.
//
// Design: docs/DESIGN-MISSES.md. Engine side: CONTRACTS C12 A19 (`rappel:load`,
// the `personal:` deck namespace) and rappel-site/llms.txt. The Book never
// imports Rappel's JS; the whole coupling stays C6.
//
// This module is the collector and the card builder and nothing else. It does
// not fetch (the reader is passed in), it does not draw (js/render-today.js
// does) and it does not post (js/embed.js does), which is what lets a node test
// build both fixture decks from the real Book and run them through Rappel's own
// validator before anything is ever sent to a frame.
//
// Two things in here are load bearing, and each of them is a bug class:
//
//  1. A note id is derived from the miss key alone. It does not move with the
//     deck's order, the reader's language or the day, so a rebuild keeps every
//     card's identity and A19 rule 5 keeps its scheduling. A note id that moved
//     would restart the schedule on every rebuild, the `#d=` failure A19 exists
//     to avoid.
//  2. The version is bumped only when the built content differs from the last
//     document sent. Same version, same document, and the engine no-ops it, so
//     "sent on every mount" and "re-sent when its version changed" are one
//     behaviour rather than two code paths that can disagree.
//
// Where the rows come from. DESIGN-MISSES.md puts an index in the progress
// store, written by `recordAttempt`. This round does not own js/progress.js, so
// the rows are derived instead from the evidence windows that `recordAttempt`
// already writes: every graded attempt is in one, with its itemId, skill,
// chapter, exercise and source. The one difference is the horizon. A window
// holds the newest 200 attempts per skill (C8.2), so a miss that has aged out
// of its own skill's window is not in the deck. The index's own cap is the same
// 200, and llms.txt says plainly which of the two this build has.
//
// Nothing here marks a miss learned, nothing removes a row because of a later
// correct answer, and only the cap drops a card. Rappel decides the rest.

import { state, bookSlot, saveProgress } from './state.js';
import { t, ui } from './i18n.js';

/** The newest misses that become cards. Oldest dropped at build. */
export const MISS_CAP = 200;
/** The five fields every card carries. `Key` is how an answer comes home. */
export const DECK_FIELDS = Object.freeze(['Front', 'Back', 'Why', 'From', 'Key']);
export const TEMPLATE_ID = 'recall';
/** The synthetic exercise id the Today view mounts this deck under. */
export const MISSES_EXERCISE_ID = 'your-misses';
/** A miss becomes a card only from these two. Never 'rappel': see below. */
const CARD_SOURCES = ['quiz', 'shell'];
/**
 * The generic types whose item has one prompt and one answer to put on a card.
 * `order`, `custom` and `speak` are skipped on purpose: there is no single
 * front and back to build, and a card with a guessed front is worse than none.
 */
const GENERIC_TYPES = ['choice', 'typed', 'listen', 'match'];
const SEP = ' · ';
const BEAT_SEP = '・';
const HEX = '0123456789abcdef';

/** C6.1 / A19: `personal:<host>:<...>`, and the host segment is this site's. */
export function missesDeckId(bookId) {
  return `personal:runcible:${bookId}`;
}

/**
 * The identity of one miss. `where` is the set id for a quiz miss and the
 * chapter id for a generic one, so the same item missed in two exercises over
 * one set is one card rather than two.
 */
export function missKey(source, where, itemId) {
  return `miss:${source}:${where}:${itemId}`;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  let out = '';
  for (const b of new Uint8Array(digest)) out += HEX[b >> 4] + HEX[b & 15];
  return out;
}

/**
 * `m_` plus the first 12 hex of SHA-256 of the key. A note id may not hold a
 * colon (card identity is `noteId:templateId`) and a generic itemId can
 * (`kana:あ`), so the key rides in a field instead.
 */
export async function noteIdFor(key) {
  return `m_${(await sha256Hex(key)).slice(0, 12)}`;
}

/** A local YYYY-MM-DD, because the version is read by a person. */
export function ymd(at) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Every miss in the progress store, merged per exercise and item, newest first.
 * A repeat merges: `at` moves to the newest and `n` counts. A later correct
 * answer does not delete the row, because the scheduler decides when a card is
 * learned and this page never does. A `source: 'rappel'` attempt is never a
 * row (that miss is already a card, in the deck that produced it), and a synced
 * record (C12 A18) carries no itemId and falls out on the same test.
 */
export function gatherMisses(bookId) {
  const slot = bookSlot(bookId);
  const groups = new Map();
  for (const list of Object.values(slot.evidence || {})) {
    for (const a of list || []) {
      if (a.correct !== false) continue;
      if (!a.itemId || !a.skill || !a.chapterId || !a.exerciseId) continue;
      if (!CARD_SOURCES.includes(a.source)) continue;
      const id = `${a.source}|${a.chapterId}|${a.exerciseId}|${a.itemId}`;
      const row = groups.get(id);
      if (!row) {
        groups.set(id, {
          at: a.at || 0, n: 1, itemId: a.itemId, skill: a.skill,
          chapterId: a.chapterId, exerciseId: a.exerciseId, source: a.source,
        });
        continue;
      }
      row.n += 1;
      if ((a.at || 0) >= row.at) { row.at = a.at || 0; row.skill = a.skill; }
    }
  }
  return [...groups.values()].sort((x, y) => y.at - x.at);
}

/** The spec of one exercise inside a loaded chapter document. */
function specOf(doc, exerciseId) {
  for (const rung of (doc && doc.rungs) || []) {
    for (const ex of rung.exercises || []) if (ex.id === exerciseId) return ex;
  }
  return null;
}

/** Read a field, dotted paths allowed, with no language applied. */
function rawField(item, field) {
  if (!item || typeof field !== 'string' || field === '') return undefined;
  if (field in item) return item[field];
  let cur = item;
  for (const part of field.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** The English side of a value, which is what an itemId was written against. */
function stableText(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(stableText).join(' ');
  if (typeof v === 'object') {
    for (const key of ['en', 'es']) {
      const got = v[key];
      if (got !== null && got !== undefined && got !== '') return stableText(got);
    }
    return '';
  }
  return String(v);
}

/** A value in the reader's language, one string. Records a fallback (C2). */
function display(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(display).filter(Boolean).join(SEP);
  const one = t(v);
  return typeof one === 'string' ? one : String(one);
}

/**
 * The item an attempt was written against. js/exercises/items.js `itemIdOf` has
 * four rules; this reads the three that are stable: the item's own id (prefixed
 * when the spec asks), the field the spec names as the id, and the identity
 * field's English side. Rule 4 is a position in the file, which moves when the
 * file is edited, so an item that relies on it becomes no card at all rather
 * than the wrong one.
 */
function matchItem(items, spec, itemId, idField) {
  const prefix = spec.itemIdPrefix ? `${spec.itemIdPrefix}:` : '';
  const bare = prefix && itemId.startsWith(prefix) ? itemId.slice(prefix.length) : itemId;
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    if (item.id !== undefined && String(item.id) === bare) return item;
    if (spec.itemIdField && stableText(rawField(item, spec.itemIdField)) === bare) return item;
    if (idField && stableText(rawField(item, idField)) === bare) return item;
  }
  return null;
}

/** The set item an engine's itemId names. A quiz set item carries its own id. */
function matchSetItem(items, itemId) {
  const tail = itemId.includes(':') ? itemId.slice(itemId.lastIndexOf(':') + 1) : itemId;
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    if (String(item.id) === itemId || String(item.id) === tail) return item;
  }
  return null;
}

/** Back, plus the set's own note when the item has one. */
function withNote(back, note) {
  const extra = display(note);
  return extra ? `${back}${SEP}${extra}` : back;
}

/** One card per game, exactly as the design's table gives it. */
const CARD_BY_GAME = {
  beats: (item) => ({
    front: display(item.kana),
    back: ui('beatsBack', {
      n: item.beats,
      split: Array.isArray(item.split) ? item.split.join(BEAT_SEP) : display(item.split),
    }),
    why: display(item.explain),
  }),
  sound: (item) => ({
    front: display(item.kana),
    back: ui('soundBack', { sound: display(item.sound), row: display(item.row) }),
    why: '',
  }),
  pairs: (item) => ({
    front: display(item.left),
    back: withNote(display(item.right), item.note),
    why: '',
  }),
  order: (item) => ({
    front: display(item.gloss),
    back: display(item.line),
    why: '',
  }),
};

/** The field a generic type shows, and the field it grades. */
function genericFields(spec) {
  return { front: spec.prompt || spec.speak || spec.left, back: spec.answer || spec.right };
}

/**
 * One miss as a card, or null when its item can no longer be found. A null is
 * not an error: data is edited, the row stays in the store so the card comes
 * back if the item does, and the caller counts them for one console line.
 */
async function cardFrom(book, docs, read, g, facts) {
  const doc = docs && docs.get ? docs.get(g.chapterId) : null;
  if (!doc) return null;
  const spec = specOf(doc, g.exerciseId);
  if (!spec) return null;

  if (g.source === 'quiz') {
    if (!spec.src) return null;
    const got = await read(spec.src);
    const set = got && got.value;
    if (!set || !Array.isArray(set.items)) return null;
    const make = CARD_BY_GAME[spec.game || set.game];
    if (!make) return null;
    const item = matchSetItem(set.items, g.itemId);
    if (!item) return null;
    // C4: the set file's own id is the name the key is written against, so a
    // set that is renamed is a new card rather than a card that quietly points
    // at the wrong item.
    const setId = typeof set.id === 'string' && set.id ? set.id : g.exerciseId;
    noteLicence(book, facts, got.src, set);
    return {
      key: missKey('quiz', setId, g.itemId),
      card: make(item),
      from: display(set.name) || display(spec.title) || spec.id,
      src: got.src,
      row: { ...g, setId },
    };
  }

  if (!GENERIC_TYPES.includes(spec.type)) return null;
  const fields = genericFields(spec);
  if (!fields.front || !fields.back) return null;
  let items = spec.items;
  let src = null;
  if (!Array.isArray(items)) {
    if (typeof items !== 'string' || items === '') return null;
    const got = await read(items);
    items = Array.isArray(got.value) ? got.value : null;
    src = got.src;
    if (got.doc) noteLicence(book, facts, got.src, got.doc);
  }
  if (!items) return null;
  const item = matchItem(items, spec, g.itemId, fields.front);
  if (!item) return null;
  return {
    key: missKey('shell', g.chapterId, g.itemId),
    card: {
      front: display(rawField(item, fields.front)),
      back: display(rawField(item, fields.back)),
      why: display(item.explain),
    },
    from: display(spec.title) || spec.id,
    src,
    row: { ...g, setId: null },
  };
}

// ── The licence of the cards, which travels with them ────────────────────────
// C11.3 renders the acknowledgement on every screen that shows the data, and a
// card is one of those screens even inside Rappel's frame. So the deck carries
// the obligation of the strictest source its cards draw from, and Today renders
// the same line beside it.

// An id this shell does not know sorts above public domain and below share
// alike: it may never displace a share-alike obligation, nor read as free.
function rank(spdx) {
  const s = String(spdx || '').toUpperCase();
  if (s === '' || s === 'PUBLIC-DOMAIN' || s === 'UNSPECIFIED' || s.startsWith('CC0')) return 0;
  if (s.startsWith('CC-BY-SA') || s.endsWith('-SA') || s.includes('-SA-')) return 3;
  return s.startsWith('CC-BY') ? 2 : 1;
}

/** Remember what one data file's licence obliges. Memoised per src. */
function noteLicence(book, facts, src, doc) {
  if (!src || facts.has(src)) return;
  const entry = ((book && book.data) || []).find((d) => d.src === src) || null;
  const lic = doc && doc.licence && typeof doc.licence === 'object' ? doc.licence : {};
  const under = (doc && doc._licence) || {};
  const creditId = under.id || (entry && entry.attribution) || null;
  const credit = ((book && book.credits) || []).find((c) => c.id === creditId) || null;
  facts.set(src, {
    src,
    spdx: lic.spdx || under.spdx || (entry && entry.licence) || 'unspecified',
    // Either the manifest or the file may require the screen, and the file is
    // never overruled downward: the failure mode of trusting the manifest is a
    // licence breach that renders as a clean page (js/books.js says the same).
    required: (entry && entry.screen === 'required') || lic.screen === 'required' || under.screen === 'required',
    wording: under.acknowledgement || lic.attribution || (credit ? credit.name : null),
    url: lic.source || under.url || null,
  });
}

/** The one licence the deck carries: the most restrictive of its sources. */
export function mergeLicence(list) {
  const facts = [...list];
  if (!facts.length) return null;
  let best = facts[0];
  for (const f of facts) if (rank(f.spdx) > rank(best.spdx)) best = f;
  const wordings = [];
  for (const f of facts) {
    if (f.required && f.wording && !wordings.includes(f.wording)) wordings.push(f.wording);
  }
  const out = {
    licence: best.spdx,
    screen: facts.some((f) => f.required) ? 'required' : 'none',
    attribution: wordings.join(' '),
    source: (facts.find((f) => f.required && f.url) || {}).url || null,
  };
  // C4.3 amendment 1: an SPDX id does not carry the wording. A CC-BY deck with
  // no wording is refused by the validator, and would be a breach if it were
  // not, so this fallback says whatever is known.
  if (String(out.licence).toUpperCase().startsWith('CC-BY')) {
    out.screen = 'required';
    if (!out.attribution) {
      const any = facts.find((f) => f.wording);
      out.attribution = any ? any.wording : `${out.licence}, see ${best.src}`;
    }
  }
  return out;
}

/**
 * The version. `YYYY-MM-DD` of the newest miss, plus a counter that moves only
 * when the built content differs from the last document sent. The date never
 * goes backwards: only the cap removes a row, so the newest miss cannot get
 * older, and if it ever did (a store edited by hand) the stored date is kept
 * and the counter moves instead. The engine ignores an older version with
 * nothing but a console line, which would leave a stale deck on screen.
 */
function bumpVersion(bookId, date, sig) {
  const slot = bookSlot(bookId);
  const prev = slot.misses && typeof slot.misses === 'object' ? slot.misses : null;
  if (prev && prev.sig === sig && typeof prev.date === 'string' && Number.isInteger(prev.n)) {
    return `${prev.date}.${prev.n}`;
  }
  let d = date;
  let n = 1;
  if (prev && typeof prev.date === 'string' && prev.date) {
    if (date > prev.date) n = 1;
    else { d = prev.date; n = (Number.isInteger(prev.n) ? prev.n : 0) + 1; }
  }
  slot.misses = { date: d, n, sig };
  saveProgress();
  return `${d}.${n}`;
}

/**
 * Build the personal deck for one Book, or null when it has no card yet.
 *
 * @param {object} book the open manifest
 * @param {Map<string, object>} docs chapter documents, by chapter id
 * @param {(pointer: string) => Promise<{src: string, doc: object, value: *}>} read
 *        a C3.2 pointer or a bare src, resolved by the shell. Nothing here
 *        fetches, so the same builder runs under node against files on disk.
 * @returns {Promise<null|{deck, rows: Map, cards: number, skipped: number}>}
 */
export async function buildMissesDeck(book, docs, read) {
  if (!book || !book.id) throw new Error('buildMissesDeck: no Book is open');
  const facts = new Map();
  const built = new Map();
  let skipped = 0;

  for (const g of gatherMisses(book.id)) {
    let one = null;
    try {
      one = await cardFrom(book, docs, read, g, facts);
    } catch (e) {
      console.warn(`[runcible] your misses: ${g.chapterId}/${g.exerciseId} ${g.itemId}: ${e.message}`);
      one = null;
    }
    if (!one || !one.card || !one.card.front) { skipped += 1; continue; }
    const prev = built.get(one.key);
    if (prev) {
      // Two exercises over one set are one card: the counts add up and the
      // newer of the two dates the deck.
      prev.row.n += one.row.n;
      if (one.row.at > prev.row.at) { prev.row.at = one.row.at; prev.row.skill = one.row.skill; }
      continue;
    }
    built.set(one.key, one);
  }

  if (!built.size) return null;
  const cards = [...built.values()].sort((a, b) => b.row.at - a.row.at).slice(0, MISS_CAP);

  const used = new Map();
  for (const one of cards) if (one.src && facts.has(one.src)) used.set(one.src, facts.get(one.src));
  const licence = mergeLicence(used.values());

  const rows = new Map();
  const notes = [];
  const skills = new Map();
  for (const one of cards) {
    const id = await noteIdFor(one.key);
    rows.set(id, { ...one.row, key: one.key, noteId: id });
    notes.push({
      id,
      f: {
        Front: one.card.front,
        Back: one.card.back || '',
        Why: one.card.why || '',
        From: ui('missesFrom', { name: one.from }),
        Key: one.key,
      },
      // C4: a note's own skill wins over the template's, which is what makes a
      // review of this card evidence for the chapter the miss came from.
      skill: one.row.skill,
    });
    skills.set(one.row.skill, (skills.get(one.row.skill) || 0) + 1);
  }
  // Sorted by note id, so the document is a function of its content and not of
  // the order the misses happened in. A repeated miss of a card that is already
  // here changes nothing, and nothing is what the engine then has to do.
  notes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  let templateSkill = notes[0].skill;
  let most = 0;
  for (const [skill, n] of skills) if (n > most) { most = n; templateSkill = skill; }

  const deck = {
    format: 'neo-deck/1',
    id: missesDeckId(book.id),
    version: '',
    name: { en: ui('missesTitle', null, 'en'), es: ui('missesTitle', null, 'es') },
    // The front is the Book's own content language, never a language named in
    // this file: nothing under js/ may name a subject (C1.1).
    lang: { front: (book.lang && book.lang.content) || 'en', back: state.prefs.lang },
    fields: [...DECK_FIELDS],
    templates: [{
      id: TEMPLATE_ID,
      kind: 'basic',
      skill: templateSkill,
      front: '{{Front}}',
      back: '{{Back}}<br>{{Why}}<br>{{From}}',
    }],
    notes,
  };
  if (licence) {
    deck.licence = licence.licence;
    deck.screen = licence.screen;
    if (licence.attribution) deck.attribution = licence.attribution;
    if (licence.source) deck.source = licence.source;
  }

  const sig = await sha256Hex(JSON.stringify({
    lang: deck.lang, name: deck.name, templates: deck.templates, notes: deck.notes,
    licence: deck.licence || null, screen: deck.screen || null,
    attribution: deck.attribution || null, source: deck.source || null,
  }));
  deck.version = bumpVersion(book.id, ymd(cards[0].row.at), sig);

  if (skipped) {
    console.warn(`[runcible] your misses: ${skipped} miss(es) whose item is no longer in its data, kept in the store and not built`);
  }
  return { deck, rows, cards: notes.length, skipped, licence };
}
