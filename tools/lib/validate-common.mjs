/**
 * The vocabulary every Book check is written in: the three format ids, the
 * closed sets a field may hold, and the four helpers that report a problem, a
 * bilingual value, a data path and a pointer.
 *
 * Split out of tools/validate-book.mjs on 2026-09-08, when that file reached
 * 560 lines against the fleet's 500 cap. Nothing here changed in the move: the
 * checks and their wording are the ones the entry file carried, because the
 * message is the whole product of a validator and a reworded one is a
 * different tool. Same reason deck-skills.mjs and page-links.mjs are files.
 *
 * Node is never imported here, so a browser can load this module as-is
 * (js/books.js imports the entry at load time).
 */

export const FORMATS = {
  catalog: 'neo-book-index/1',
  manifest: 'neo-book/1',
  chapter: 'neo-chapter/1',
};

/** C3.3, page kinds and the fields each one needs. */
export const PAGE_FIELDS = {
  prose: ['body'],
  table: ['columns'],
  figure: ['figure'],
  callout: ['body'],
};

export const STATES = ['ready', 'stub', 'planned'];
export const CALLOUT_TONES = ['note', 'warn', 'win'];
export const HTML_TAG = /<[a-zA-Z/!][^>]*>/;
export const SLUG = /^[a-z0-9][a-z0-9-]*$/;
export const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function report() {
  const errors = [];
  const warnings = [];
  return {
    err: (path, message) => { errors.push({ path, message }); },
    warn: (path, message) => { warnings.push({ path, message }); },
    done: () => ({ ok: errors.length === 0, errors, warnings }),
  };
}

export function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

/** A bilingual value: a bare string is legal, per the CONTRACTS preamble. */
export function checkBilingual(r, path, value, { required = true, allowArray = false } = {}) {
  if (value === null || value === undefined) return void (required && r.err(path, 'is required'));
  if (typeof value === 'string') {
    if (HTML_TAG.test(value)) r.err(path, 'contains inline HTML, which C3.3 forbids in a content field');
    return;
  }
  if (allowArray && Array.isArray(value)) {
    value.forEach((v, i) => checkBilingual(r, `${path}[${i}]`, v, { required: false }));
    return;
  }
  if (!isObj(value)) { r.err(path, 'must be a string or an { en, es } object'); return; }
  for (const key of Object.keys(value)) {
    if (key !== 'en' && key !== 'es') r.err(`${path}.${key}`, 'is not a language key, only en and es exist');
  }
  if (required && value.en === undefined && value.es === undefined) r.err(path, 'has neither en nor es');
  const line = (at, v) => {
    if (typeof v !== 'string') r.err(at, 'must be a string');
    else if (HTML_TAG.test(v)) r.err(at, 'contains inline HTML, which C3.3 forbids in a content field');
  };
  for (const key of ['en', 'es']) {
    const v = value[key];
    if (v === undefined || v === null) continue;
    if (!Array.isArray(v)) line(`${path}.${key}`, v);
    else if (!allowArray) r.err(`${path}.${key}`, 'is an array where a string is expected');
    else v.forEach((x, i) => line(`${path}.${key}[${i}]`, x));
  }
}

/** A data path: same-origin, relative to the site root, no traversal. */
export function checkDataPath(r, path, src) {
  if (typeof src !== 'string' || !src) { r.err(path, 'must be a non-empty path'); return false; }
  if (/^[a-z]+:/i.test(src) || src.startsWith('//') || src.startsWith('/')) {
    r.err(path, 'must be a same-origin path relative to the site root, with no scheme and no leading slash');
    return false;
  }
  if (src.split('/').includes('..')) { r.err(path, 'must not contain a ".." segment'); return false; }
  return true;
}

/** The path half of a C3.2 pointer. */
export function pointerPath(pointer) {
  const raw = String(pointer || '');
  const i = raw.indexOf('#');
  return i < 0 ? raw : raw.slice(0, i);
}
