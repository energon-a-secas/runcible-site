// The Book catalog, the manifest loader, and the data permission list.
// Contracts C1, C2.2, C2.4, C3.2, C11.3.
//
// Nothing in this file, or anywhere under js/, may name a subject. A Book is an
// id, a glyph, a ladder of chapters and a list of declared data files. What it
// teaches is data. C1.1 states the acceptance test: adding a Book is one array
// entry plus a directory, and no file under js/ changes.

import { validateCatalog, validateManifest, validateChapter } from '../tools/validate-book.mjs';
import { createExerciseRegistry, tts } from './exercises/index.js';
import { state, setPref } from './state.js';
import { recordAttempt } from './progress.js';
import { t, tList } from './i18n.js';

/** Everything resolves against the directory index.html was served from. */
const ROOT = new URL('./', document.baseURI);

export const CATALOG_SRC = 'books/index.json';

const dataCache = new Map();     // absolute url -> parsed json
const chapterCache = new Map();  // bookId/chapterId -> chapter document

/** A load failure that names the file, so the console says which one. */
export class LoadError extends Error {
  constructor(message, file) {
    super(file ? `${message} (${file})` : message);
    this.name = 'LoadError';
    this.file = file || null;
  }
}

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url, { credentials: 'omit' });
  } catch (e) {
    throw new LoadError(`could not be fetched: ${e.message}`, url);
  }
  if (!res.ok) throw new LoadError(`fetch failed with ${res.status}`, url);
  try {
    return await res.json();
  } catch (e) {
    throw new LoadError(`is not valid JSON: ${e.message}`, url);
  }
}

function refuse(report, file) {
  if (report.ok) {
    for (const w of report.warnings) console.warn(`[runcible] ${file}: ${w.path} ${w.message}`);
    return;
  }
  const first = report.errors[0];
  throw new LoadError(`${report.errors.length} schema error(s), first: ${first.path} ${first.message}`, file);
}

/** books/index.json. The only place a Book is discovered. C1.1. */
export async function loadCatalog() {
  if (state.catalog) return state.catalog;
  const url = new URL(CATALOG_SRC, ROOT).href;
  const doc = await fetchJson(url);
  refuse(validateCatalog(doc), CATALOG_SRC);
  state.catalog = doc;
  return doc;
}

/** Open a Book: fetch its manifest, validate it, and register its modules. */
export async function openBook(bookId) {
  if (state.book && state.book.id === bookId) return state.book;
  const catalog = await loadCatalog();
  const listed = (catalog.books || []).find((b) => b.id === bookId);
  if (!listed) throw new LoadError(`book "${bookId}" is not in the catalog`, CATALOG_SRC);
  if (listed.state === 'planned') throw new LoadError(`book "${bookId}" is planned and has no manifest`, CATALOG_SRC);

  const dir = `books/${bookId}/`;
  const src = dir + 'book.json';
  const doc = await fetchJson(new URL(src, ROOT).href);
  refuse(validateManifest(doc), src);
  if (doc.id !== bookId) throw new LoadError(`manifest id "${doc.id}" does not match its directory`, src);

  doc.dir = dir;
  doc.listed = listed;
  if (state.book && state.book.id !== bookId) engine().resetBook(state.book.id);
  state.book = doc;
  // The one place a Book becomes the open Book, so the one place the pref and
  // the sync scope are set (C12 A2). The book view used to set it, which left
  // a deep link straight into a chapter unscoped and therefore unsynced.
  setPref('bookId', bookId);
  await loadModules(doc);
  return doc;
}

// The data permission list, C1.3 rule 2.
//
// "data[] is a permission list, not documentation. The shell resolves a src
// from a chapter only if that src appears in data[]. An undeclared path is a
// load error naming the file."
//
// This is what makes the A2/C file boundary a runtime check instead of an
// agreement, and it is what drives the C11.3 acknowledgement: a page renders
// the licence block because its data said so, not because an author remembered.

/** The manifest entry declaring a src, or null. */
export function declaredEntry(book, src) {
  return ((book && book.data) || []).find((d) => d.src === src) || null;
}

/** Throw unless the manifest declared this src. */
export function assertDeclared(book, src, who) {
  if (declaredEntry(book, src)) return true;
  throw new LoadError(`"${src}" is not declared in the manifest's data[], so ${who || 'this chapter'} may not load it`, book.dir + 'book.json');
}

/** Fetch a declared data file once, and cache it. */
export async function loadData(book, src, who) {
  assertDeclared(book, src, who);
  const url = new URL(src, ROOT).href;
  if (dataCache.has(url)) return dataCache.get(url);
  const doc = await fetchJson(url);
  dataCache.set(url, doc);
  return doc;
}

/**
 * Load every chapter file of a Book and return them keyed by id.
 *
 * The manifest carries ids, not goals: goal.evidence lives in the chapter file
 * (C3.1), so nothing can decide what is passed or locked without these. They
 * are small. The corpus slices they point at are not, so the ladder asks for
 * the files alone and the data waits for the chapter to open (C11.6).
 */
export async function loadLadder(book) {
  await Promise.allSettled(
    (book.chapters || []).filter((c) => c.src).map((c) => loadChapter(book, c.id, { data: false })),
  );
  return new Map(cachedChapters(book.id).map((doc) => [doc.id, doc]));
}

/** Every chapter document already fetched for a Book, in cache order. */
export function cachedChapters(bookId) {
  const out = [];
  for (const [key, doc] of chapterCache) if (key.startsWith(bookId + '/')) out.push(doc);
  return out;
}

/** An already-loaded data document, or null. */
export function peekData(src) {
  return dataCache.get(new URL(src, ROOT).href) || null;
}

/**
 * The C3.2 data pointer: "<path>#<dotted.path>".
 * The fragment is a dotted lookup, with a bare key allowed for a top-level map
 * so that a key containing a dot, or any non-latin key, still resolves.
 */
export function splitPointer(pointer) {
  const raw = String(pointer || '');
  const i = raw.indexOf('#');
  if (i < 0) return { src: raw, frag: '' };
  return { src: raw.slice(0, i), frag: raw.slice(i + 1) };
}

/** Walk a fragment into a loaded document. */
export function resolveFragment(doc, frag, file) {
  if (!frag) return doc;
  if (doc && typeof doc === 'object' && Object.prototype.hasOwnProperty.call(doc, frag)) return doc[frag];
  let cur = doc;
  for (const key of frag.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') {
      throw new LoadError(`pointer "#${frag}" does not resolve`, file);
    }
    cur = cur[key];
  }
  if (cur === undefined) throw new LoadError(`pointer "#${frag}" does not resolve`, file);
  return cur;
}

/** Resolve a full data pointer, loading its file if needed. */
export async function resolvePointer(book, pointer, who) {
  const { src, frag } = splitPointer(pointer);
  const doc = await loadData(book, src, who);
  return resolveFragment(doc, frag, src);
}

const dataLoaded = new Set();

/**
 * Load a chapter and, unless `{ data: false }`, every data file it declares.
 * C11.6: data on open, not at boot. The ladder passes `data: false`; a chapter
 * view uses the default, and a file cached without its data gets it then.
 */
export async function loadChapter(book, chapterId, opts = {}) {
  const key = `${book.id}/${chapterId}`;
  const withData = opts.data !== false;
  if (chapterCache.has(key)) {
    const cached = chapterCache.get(key);
    if (withData) await loadChapterData(book, chapterId, cached, key);
    return cached;
  }
  const entry = (book.chapters || []).find((c) => c.id === chapterId);
  if (!entry) throw new LoadError(`chapter "${chapterId}" is not in the manifest`, book.dir + 'book.json');
  if (!entry.src) throw new LoadError(`chapter "${chapterId}" is ${entry.state || 'planned'} and has no file`, book.dir + 'book.json');

  const src = book.dir + entry.src;
  const doc = await fetchJson(new URL(src, ROOT).href);
  refuse(validateChapter(doc, book), src);
  if (doc.id !== chapterId) throw new LoadError(`chapter file id "${doc.id}" does not match the manifest entry "${chapterId}"`, src);

  chapterCache.set(key, doc);
  if (withData) await loadChapterData(book, chapterId, doc, key);
  return doc;
}

async function loadChapterData(book, chapterId, doc, key) {
  if (dataLoaded.has(key)) return;
  for (const dataSrc of doc.data || []) {
    await loadData(book, dataSrc, `chapter ${chapterId}`);
  }
  dataLoaded.add(key);
}

/**
 * The acknowledgements a chapter must show. C11.3.
 *
 * Structural, not checked: the block renders because a declared data file said
 * screen: "required", so an author cannot forget it and no smoke check has to
 * notice. The exact wording comes from the data file's own _licence block,
 * which is where the licence obligation is recorded (C11.2).
 */
export function attributionsFor(book, chapter) {
  const out = [];
  const seen = new Set();
  for (const src of (chapter && chapter.data) || []) {
    const entry = declaredEntry(book, src);
    const doc = peekData(src);
    const lic = (doc && doc._licence) || {};
    // Two places say whether a licence must be acknowledged on screen: the
    // manifest's data[] entry (C11.3) and the data file's own _licence block,
    // which is where the obligation is actually recorded (C11.2). Either one
    // is enough. A manifest that says screen: "none" over a file that says
    // "required" is an authoring mistake, and the failure mode of trusting the
    // manifest is a licence breach that renders as a clean page, so the file
    // is never allowed to be overruled downward. make validate names the
    // disagreement so it does not just quietly over-credit forever.
    const required = (entry && entry.screen === 'required') || lic.screen === 'required';
    if (!required) continue;
    const id = lic.id || (entry && entry.attribution) || src;
    if (seen.has(id)) continue;
    seen.add(id);
    const credit = ((book.credits || []).find((c) => c.id === id)) || null;
    let text = lic.acknowledgement;
    if (!text) {
      // The licence still has to appear, so say what is known and be loud about
      // what is missing rather than rendering nothing.
      console.warn(`[runcible] ${src}: screen is "required" but _licence.acknowledgement is missing`);
      text = credit ? `${credit.name} (${lic.spdx || entry?.licence || 'see source'})` : src;
    }
    out.push({ id, text, links: Array.isArray(lic.links) ? lic.links : [], url: lic.url || null, name: credit ? credit.name : id });
  }
  return out;
}

// Book modules, C1.3 rule 4 and C2.2.

/**
 * The exercise engine (workstream A1b), one registry for the page.
 * The shell imports js/exercises/index.js and nothing else under that
 * directory, and a Book never imports it at all: it receives the frozen
 * runcible object the registry builds for it (C2.2).
 */
let registry = null;
export function engine() {
  if (!registry) registry = createExerciseRegistry();
  return registry;
}

/**
 * Import every module a manifest declares and hand its default export to the
 * registry, which builds the frozen runcible object, holds the module to its
 * modules[].provides declaration and refuses anything undeclared (C1.3 rule 4,
 * C2.2). The shell owns the URL; the registry owns what may be registered.
 */
export async function loadModules(book) {
  const out = [];
  for (const mod of book.modules || []) {
    const url = new URL(book.dir + mod.path, ROOT).href;
    let ns;
    try {
      ns = await import(url);
    } catch (e) {
      throw new LoadError(`module could not be imported: ${e.message}`, book.dir + mod.path);
    }
    try {
      engine().registerBookModule({
        bookId: book.id,
        path: mod.path,
        register: ns.default,
        provides: mod.provides,
      });
    } catch (e) {
      throw new LoadError(e.message, book.dir + mod.path);
    }
    out.push(mod.path);
  }
  return out;
}

/** Ids registered by the open Book, for the settings screen and for debugging. */
export function registeredIds() {
  return { exercises: engine().listExercises(), transforms: engine().listTransforms() };
}

/**
 * The api object handed to every exercise. C2.3.
 * ctx is { book, chapter, exercise, onDone }.
 */
export function makeExerciseApi(ctx) {
  const { book, chapter, exercise } = ctx;
  return Object.freeze({
    attempt(a) {
      return recordAttempt(a, {
        bookId: book.id,
        chapterId: chapter.id,
        exerciseId: exercise.id,
        source: 'shell',
      });
    },
    t: (obj) => t(obj),
    tList: (obj) => tList(obj),
    get lang() { return state.prefs.lang; },
    data: (pointer) => resolvePointer(book, pointer, `exercise ${exercise.id}`),
    tts: (text, opts) => tts(text, { lang: (book.lang && book.lang.content) || 'en', voiceURI: state.prefs.ttsVoice, ...opts }),
    // C11.3 renders from the manifest, so an exercise never has to ask.
    done: (result) => ctx.onDone(result || null),
  });
}
