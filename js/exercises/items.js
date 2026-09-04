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

/** Read a field, dotted paths allowed, from an item object. */
export function fieldValue(item, field) {
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

/** What the learner sees. An array joins with a space, an object is refused loudly. */
export function displayValue(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(displayValue).join(' ');
  if (typeof v === 'object') return '';
  return String(v);
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
 *      spoken field, whatever the type passes as `idField`)
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
    const v = fieldValue(item, spec.itemIdField);
    if (v !== undefined && v !== null && v !== '') return prefix + displayValue(v);
  }
  const fromField = fieldValue(item, idField);
  if (fromField !== undefined && fromField !== null && fromField !== '') {
    return prefix + displayValue(fromField);
  }
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
