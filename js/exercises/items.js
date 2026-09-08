// ── Items: resolution, selection, identity ───────────────────
// A chapter names its items with a C3.2 data pointer, "<path>#<dotted.path>".
// C3.2 puts the resolver in the shell and C2.3 gives the engine api.data(src)
// to reach it, so nothing here parses a pointer: this module hands the whole
// pointer to api.data and awaits whatever comes back. Two resolvers for one
// syntax is how two ideas of a valid pointer appear.
//
// An inline array is also accepted, because a small item list has no reason to
// become a file and a fixture has no manifest to declare one in.

import { ExerciseError } from './errors.js';

// ── The reader's language ────────────────────────────────────
// An item field may hold the fleet's { en, es } object (CONTRACTS convention
// 2), and a reader has to meet their own language in a prompt, an option, a
// column of a pairing board and a line to say aloud. C2.3 freezes the api an
// exercise is handed and no type passes it down to a field reader, so the
// language is taken from that api once per run: resolveList is the first call
// every type makes and it holds the live api.
//
// One exercise is mounted at a time and one language is chosen for a whole
// page, so a module scoped value is the whole of the state. Changing language
// repaints the view, which remounts the exercise, which resolves its list
// again.
//
// api.lang is the language, and the resolving is done here: half these fields
// are lists (order's sequence) and C2.3's t returns a string, so a list sent
// through it would come back as "a,b". What api.t is still called for is the
// count behind the honesty line, when a reader's own side is missing.

let readerLang = 'en';
let readerT = null;

/**
 * Take the language of this run from the frozen api (C2.3). Exported as well
 * as called from resolveList, so a caller that never resolves a list can set
 * it for itself.
 * @param {{lang?: string, t?: function}} api
 * @returns {string} the language item fields now resolve in
 */
export function useLanguage(api) {
  if (!api || typeof api !== 'object') return readerLang;
  if (typeof api.lang === 'string' && api.lang) readerLang = api.lang.slice(0, 2).toLowerCase();
  readerT = typeof api.t === 'function' ? api.t : null;
  return readerLang;
}

/** The language item fields are resolving in. */
export function itemLanguage() {
  return readerLang;
}

/** A bilingual value is an object carrying an `en` or an `es`. Nothing else is. */
function isBilingual(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.prototype.hasOwnProperty.call(v, 'en') || Object.prototype.hasOwnProperty.call(v, 'es');
}

/** One bilingual object in one language: own, then en, then es, then empty. */
function inLang(v, lang) {
  for (const key of [lang, 'en', 'es']) {
    const got = v[key];
    if (got !== null && got !== undefined && got !== '') return got;
  }
  return '';
}

/**
 * The value this reader sees. A bilingual object resolves to their language;
 * everything else is handed back untouched, so a field that held a string
 * before behaves exactly as it did.
 */
function readerValue(v) {
  if (!isBilingual(v)) return v;
  const own = v[readerLang];
  if (own !== null && own !== undefined && own !== '') return own;
  // Nothing on the reader's own side. The shell's resolver is what counts
  // that (js/i18n.js records it, and the view prints one line saying part of
  // this page is English only), so it is called here for the count and its
  // answer is not used: a cue falling back is the same event as a paragraph
  // falling back, and a reader is told once for both.
  if (readerLang !== 'en' && readerT) readerT(v);
  return inLang(v, readerLang);
}

/**
 * The same value with no language in it, for anything stored. C2.6: itemId is
 * what progress on a visitor's disk is written against, so an English session
 * and a Spanish one must write one row for one item. English is the canonical
 * side (CONTRACTS convention 2), and a value with only Spanish resolves to
 * that, which is still the same string in both sessions.
 */
export function stableValue(v) {
  if (isBilingual(v)) return stableValue(inLang(v, 'en'));
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(stableValue).join(' ');
  if (typeof v === 'object') return '';
  return String(v);
}

/**
 * Resolve spec.items (or any pointer-or-array field) to an array.
 * @param {string|Array} source a C3.2 pointer, or an inline array
 * @param {{data?: function}} api
 * @param {object} ctx
 * @param {object} spec
 * @param {string} field the spec field being resolved, for the error message
 * @returns {Promise<Array>}
 */
export async function resolveList(source, api, ctx, spec, field) {
  // Before the early return, so an inline item list is read in the reader's
  // language too.
  useLanguage(api);
  if (Array.isArray(source)) return source;
  if (typeof source === 'string' && source) {
    if (typeof api.data !== 'function') {
      throw new ExerciseError(
        `"${field}" is the data pointer "${source}" but the shell gave this exercise no api.data`, ctx, spec);
    }
    const got = await api.data(source);
    if (Array.isArray(got)) return got;
    if (got && typeof got === 'object') return Object.values(got);
    throw new ExerciseError(
      `"${field}" resolved "${source}" to ${got === undefined ? 'nothing' : typeof got}, which is not a list`, ctx, spec);
  }
  throw new ExerciseError(
    `"${field}" must be a data pointer string or an array, got ${source === undefined ? 'nothing' : typeof source}`, ctx, spec);
}

/** Fisher-Yates on a copy. */
export function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}

/**
 * Choose the items for one run.
 * With no `count` the exercise asks every item it was given, which is honest:
 * a silent default of ten would quietly drop 36 of 46 rows.
 */
export function pickItems(items, count) {
  if (!Number.isFinite(count) || count <= 0 || count >= items.length) return shuffle(items);
  return shuffle(items).slice(0, Math.floor(count));
}

/** Read a field, dotted paths allowed, with no language applied. */
function rawFieldValue(item, field) {
  if (item === null || item === undefined) return undefined;
  if (typeof field !== 'string' || field === '') return undefined;
  if (field in item) return item[field];
  let cur = item;
  for (const part of field.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Read a field from an item, in the reader's language.
 *
 * This is the one accessor every type reads a field through, which is why the
 * bilingual rule lives here: a prompt, an answer, a left, a right, a speak, an
 * expect and a sequence are all a field name resolved by this function, so
 * they are all bilingual at once or none of them is. A plain string is handed
 * back untouched. Grading sees what the reader saw, because the value graded
 * against is the value that was shown.
 */
export function fieldValue(item, field) {
  return readerValue(rawFieldValue(item, field));
}

/**
 * What the learner sees. A bilingual object resolves, an array joins with a
 * space, any other object is still the empty string: an item that carries a
 * whole record under a field name is an authoring mistake, and a mistake with
 * no honest rendering.
 */
export function displayValue(v) {
  const value = readerValue(v);
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(displayValue).join(' ');
  if (typeof value === 'object') return '';
  return String(value);
}

/**
 * The answers an item accepts, as a list.
 *
 * `answer` may name a field holding several readings of one word: the Japanese
 * Book's `accept` is `["にほん", "にっぽん"]` for 日本 and
 * `["あした", "あす"]` for 明日, and compare.js already grades any
 * member as right. displayValue flattens a list by joining it with a space, so
 * the label built from it read "にほん にっぽん": one word nobody wrote,
 * nobody would accept, and no dictionary lists.
 *
 * This keeps the list a list. Turning it into a sentence is the type's job,
 * because the word between the readings is language and belongs in strings.js.
 *
 * Blanks and repeats are dropped: an author who writes ["にほん", ""] means
 * one accepted reading, and a label that says so twice is a label with a bug.
 *
 * @param {*} value the raw value of the answer field, a scalar or a list
 * @returns {string[]} display values, in the order the author wrote them
 */
export function acceptedValues(value) {
  const resolved = readerValue(value);
  const raw = Array.isArray(resolved) ? resolved : [resolved];
  const out = [];
  for (const v of raw) {
    const one = displayValue(v).trim();
    if (one && !out.includes(one)) out.push(one);
  }
  return out;
}

const warned = new Set();

/**
 * The stable id of the thing tested, for C2.3's `itemId`.
 *
 * C2 and C3 do not say where it comes from, so the rule is stated here and in
 * README.md rather than guessed per type:
 *
 *   1. item.id, prefixed by spec.itemIdPrefix when present
 *   2. the field named by spec.itemIdField
 *   3. the value of the item's identity field for this type (the prompt, the
 *      spoken field, whatever the type passes as `idField`), with no language
 *      in it: a bilingual field resolves to its English side here whatever the
 *      reader is reading, so two sessions write one row
 *   4. the exercise id plus the position, which is NOT stable across a data
 *      edit and says so once on the console
 *
 * Rule 1 is the one an author should use. An item with an id keeps the same
 * itemId when the same thing is tested in both directions, which is what makes
 * "weak items resurface" mean anything.
 */
export function itemIdOf(item, spec, idField, index) {
  const prefix = spec.itemIdPrefix ? `${spec.itemIdPrefix}:` : '';
  const own = item && typeof item === 'object' ? item.id : undefined;
  if (typeof own === 'string' && own) return prefix + own;
  if (typeof own === 'number') return prefix + String(own);
  if (spec.itemIdField) {
    const named = stableValue(rawFieldValue(item, spec.itemIdField));
    if (named !== '') return prefix + named;
  }
  const fromField = stableValue(rawFieldValue(item, idField));
  if (fromField !== '') return prefix + fromField;
  const key = `${spec.id}`;
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(
      `[runcible] exercise "${spec.id}" has items with no id and no usable "${idField}" field, ` +
      'so itemId falls back to a position. Positions move when the data file is edited, ' +
      'and C2.6 says itemId is what stored progress is written against.');
  }
  return `${prefix}${spec.id}#${index}`;
}

/**
 * Distractors for a choice question. C10.3 rule 4: from siblings, never from
 * the whole set, when a grouping field exists. A distractor drawn at random is
 * not a discriminator.
 *
 * @param {object} spec
 * @param {object} item the item being asked
 * @param {Array} pool the resolved item list
 * @param {string} answerField
 * @param {object} ctx
 * @returns {string[]} display values, never containing the correct answer
 */
export function distractorsFor(spec, item, pool, answerField, ctx) {
  const d = spec.distractors || {};
  const want = Number.isFinite(d.n) ? Math.floor(d.n) : 3;
  const correct = displayValue(fieldValue(item, answerField));

  let candidates;
  if (Array.isArray(d.values)) {
    candidates = d.values.map(displayValue);
  } else {
    let siblings = pool;
    if (d.by) {
      const group = fieldValue(item, d.by);
      const same = pool.filter((o) => fieldValue(o, d.by) === group);
      if (same.length > 1) siblings = same;
    }
    candidates = siblings.map((o) => displayValue(fieldValue(o, answerField)));
  }

  // Two items can share a gloss ("good morning" twice, at two politeness
  // levels), so a sibling whose answer overlaps the right one by any
  // semicolon-separated sense is a second right answer, not a wrong option.
  const senses = (s) => String(s).split(/\s*;\s*/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const own = new Set(senses(correct));
  const unique = [];
  for (const c of candidates) {
    if (c === '' || c === correct || unique.includes(c)) continue;
    if (senses(c).some((x) => own.has(x))) continue;
    unique.push(c);
  }
  if (unique.length === 0) {
    throw new ExerciseError(
      `no distractor is available for "${correct}": every item in the list has the same "${answerField}"`,
      ctx, spec);
  }
  return shuffle(unique).slice(0, Math.max(1, want));
}
