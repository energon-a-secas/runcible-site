/**
 * books/index.json, the one file that says which Books exist (C1.1).
 *
 * Its own module rather than a section of the entry file: a catalog entry is
 * four fields and a Book directory is a hundred, and the two are read at
 * different moments. Split out of tools/validate-book.mjs on 2026-09-08.
 */

import { FORMATS, STATES, SLUG, report, isObj, checkBilingual } from './validate-common.mjs';

/** books/index.json. C1.1. */
export function validateCatalog(doc) {
  const r = report();
  if (!isObj(doc)) { r.err('/', 'is not an object'); return r.done(); }
  if (doc.format !== FORMATS.catalog) r.err('format', `must be "${FORMATS.catalog}", found ${JSON.stringify(doc.format)}`);
  if (!Array.isArray(doc.books)) { r.err('books', 'must be an array'); return r.done(); }
  const seen = new Set();
  for (const [i, b] of doc.books.entries()) {
    const at = `books[${i}]`;
    if (!isObj(b)) { r.err(at, 'must be an object'); continue; }
    if (!SLUG.test(String(b.id || ''))) r.err(`${at}.id`, 'must be a lowercase slug');
    if (seen.has(b.id)) r.err(`${at}.id`, `is a duplicate of an earlier entry: ${b.id}`);
    seen.add(b.id);
    checkBilingual(r, `${at}.title`, b.title);
    if (typeof b.glyph !== 'string' || !b.glyph) r.err(`${at}.glyph`, 'is required and identifies the Book, C1.3 rule 1');
    if (!STATES.includes(b.state)) r.err(`${at}.state`, `must be one of ${STATES.join(', ')}`);
  }
  return r.done();
}
