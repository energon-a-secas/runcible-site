#!/usr/bin/env node
// The Book validator: neo-book-index/1, neo-book/1 and neo-chapter/1 (C1, C3).
// DESIGN.md 6.2: nothing in this fleet validates a JSON schema, so this is the
// only thing between a malformed Book and a blank page. There is one of it,
// used three ways: the CLI below (make validate), the shell at load time
// (js/books.js), and the runcible-book skill, which imports it rather than
// defining a second notion of valid.
//
// This file is the entry, and the checks live in four modules beside it. It
// was 560 lines against the fleet's 500 cap until 2026-09-08; the split moved
// code and moved nothing else, so every check and every message is the one it
// had. What each module holds:
//
//   lib/validate-common.mjs    formats, closed sets, report, bilingual, paths
//   lib/validate-catalog.mjs   books/index.json (C1.1)
//   lib/validate-manifest.mjs  books/<id>/book.json (C1.2, C1.3)
//   lib/validate-chapter.mjs   books/<id>/chapters/*.json (C3)
//   lib/validate-cli.mjs       the CLI, and every check that opens a file
//
// Node is imported dynamically inside the CLI module, and that module is
// loaded only when this file is being run as a program, so a browser can
// import this one as-is and never fetches the CLI.

export { GENERIC_TYPES } from '../js/exercises/index.js';
export { FORMATS, pointerPath } from './lib/validate-common.mjs';
export { validateCatalog } from './lib/validate-catalog.mjs';
export { validateManifest } from './lib/validate-manifest.mjs';
export { validateChapter } from './lib/validate-chapter.mjs';

const cli = typeof process !== 'undefined' && Array.isArray(process.argv)
  && process.argv[1] && process.argv[1].endsWith('validate-book.mjs');
if (cli) {
  import('./lib/validate-cli.mjs').then(({ main }) => main(process.argv.slice(2))).then((code) => process.exit(code));
}
