#!/usr/bin/env node
// The Book validator: neo-book-index/1, neo-book/1 and neo-chapter/1 (C1, C3).
// DESIGN.md 6.2: nothing in this fleet validates a JSON schema, so this file is
// the only thing between a malformed Book and a blank page. There is one of it,
// used three ways: the CLI below (make validate), the shell at load time
// (js/books.js), and the runcible-book skill, which imports it rather than
// defining a second notion of valid. Node is imported dynamically inside
// main(), never at the top, so a browser can import this module as-is.

import { validateExerciseSpec, GENERIC_TYPES, checkRegisteredId, parseCompare } from '../js/exercises/index.js';
import { checkDeckSkills } from './lib/deck-skills.mjs';

export { GENERIC_TYPES };

export const FORMATS = {
  catalog: 'neo-book-index/1',
  manifest: 'neo-book/1',
  chapter: 'neo-chapter/1',
};

/** C3.3, page kinds and the fields each one needs. */
const PAGE_FIELDS = {
  prose: ['body'],
  table: ['columns'],
  figure: ['figure'],
  callout: ['body'],
};

const STATES = ['ready', 'stub', 'planned'];
const CALLOUT_TONES = ['note', 'warn', 'win'];
const HTML_TAG = /<[a-zA-Z/!][^>]*>/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function report() {
  const errors = [];
  const warnings = [];
  return {
    err: (path, message) => { errors.push({ path, message }); },
    warn: (path, message) => { warnings.push({ path, message }); },
    done: () => ({ ok: errors.length === 0, errors, warnings }),
  };
}

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

/** A bilingual value: a bare string is legal, per the CONTRACTS preamble. */
function checkBilingual(r, path, value, { required = true, allowArray = false } = {}) {
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
function checkDataPath(r, path, src) {
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

/** books/<id>/book.json. C1.2 and C1.3. */
export function validateManifest(doc) {
  const r = report();
  if (!isObj(doc)) { r.err('/', 'is not an object'); return r.done(); }
  if (doc.format !== FORMATS.manifest) r.err('format', `must be "${FORMATS.manifest}", found ${JSON.stringify(doc.format)}`);
  if (!SLUG.test(String(doc.id || ''))) r.err('id', 'must be a lowercase slug matching the directory name');
  if (!DATE.test(String(doc.version || ''))) r.err('version', 'must be a YYYY-MM-DD date string, bumped on any content change (C1.3 rule 5)');
  checkBilingual(r, 'title', doc.title);
  checkBilingual(r, 'tagline', doc.tagline, { required: false });
  checkBilingual(r, 'goal', doc.goal, { required: false });
  if (typeof doc.glyph !== 'string' || !doc.glyph) r.err('glyph', 'is required');
  if ('accent' in doc || 'colour' in doc || 'color' in doc) {
    r.err('accent', 'a Book may not set a colour. C1.3 rule 1: the only identity knob is the site accent, and a Book identifies itself with glyph');
  }
  if (!isObj(doc.lang) || typeof doc.lang.content !== 'string') r.err('lang.content', 'is required');
  if (doc.lang && !Array.isArray(doc.lang.ui)) r.err('lang.ui', 'must be an array of language codes');

  const trackIds = [];
  let defaults = 0;
  if (doc.tracks !== undefined && !Array.isArray(doc.tracks)) r.err('tracks', 'must be an array');
  else for (const [i, tr] of (doc.tracks || []).entries()) {
    const at = `tracks[${i}]`;
    if (!isObj(tr)) { r.err(at, 'must be an object'); continue; }
    if (!SLUG.test(String(tr.id || ''))) r.err(`${at}.id`, 'must be a lowercase slug');
    else trackIds.push(tr.id);
    checkBilingual(r, `${at}.label`, tr.label);
    checkBilingual(r, `${at}.description`, tr.description, { required: false });
    if (tr.default) defaults += 1;
  }
  if (trackIds.length && defaults === 0) r.warn('tracks', 'no track is marked default, so the first one is used');
  if (defaults > 1) r.err('tracks', 'more than one track is marked default');

  const dataSrcs = new Set();
  if (doc.data !== undefined && !Array.isArray(doc.data)) r.err('data', 'must be an array');
  else for (const [i, d] of (doc.data || []).entries()) {
    const at = `data[${i}]`;
    if (!isObj(d)) { r.err(at, 'must be an object'); continue; }
    if (checkDataPath(r, `${at}.src`, d.src)) {
      if (dataSrcs.has(d.src)) r.err(`${at}.src`, `is declared twice: ${d.src}`);
      dataSrcs.add(d.src);
    }
    if (typeof d.licence !== 'string' || !d.licence) r.err(`${at}.licence`, 'is required, an SPDX id or "public-domain"');
    if (d.screen !== 'required' && d.screen !== 'none') r.err(`${at}.screen`, 'must be "required" or "none"');
    if (d.screen === 'required' && !d.attribution) {
      r.err(`${at}.attribution`, 'is required when screen is "required": it names the credits[] entry whose wording renders (C11.3)');
    }
  }
  const creditIds = new Set();
  if (doc.credits !== undefined && !Array.isArray(doc.credits)) r.err('credits', 'must be an array');
  else for (const [i, c] of (doc.credits || []).entries()) {
    if (!isObj(c) || !c.id) { r.err(`credits[${i}].id`, 'is required'); continue; }
    creditIds.add(c.id);
    if (typeof c.name !== 'string' || !c.name) r.err(`credits[${i}].name`, 'is required');
  }
  for (const [i, d] of (Array.isArray(doc.data) ? doc.data : []).entries()) {
    if (isObj(d) && d.attribution && !creditIds.has(d.attribution)) {
      r.err(`data[${i}].attribution`, `names "${d.attribution}", which is not in credits[]`);
    }
  }

  const transforms = new Set();
  const customTypes = new Set();
  if (doc.modules !== undefined && !Array.isArray(doc.modules)) r.err('modules', 'must be an array');
  else for (const [i, m] of (doc.modules || []).entries()) {
    const at = `modules[${i}]`;
    if (!isObj(m)) { r.err(at, 'must be an object'); continue; }
    if (checkDataPath(r, `${at}.path`, m.path) && !m.path.endsWith('.js')) r.err(`${at}.path`, 'must be a .js module inside the Book directory');
    if (!isObj(m.provides)) { r.err(`${at}.provides`, 'is required: a module declares what it registers, C1.3 rule 4'); continue; }
    for (const id of m.provides.exercises || []) {
      const problem = checkRegisteredId(id);
      if (problem) r.err(`${at}.provides.exercises`, problem);
      else customTypes.add(id);
    }
    for (const id of m.provides.transforms || []) {
      if (typeof id !== 'string' || !id) r.err(`${at}.provides.transforms`, 'transform ids must be non-empty strings');
      else transforms.add(id);
    }
  }

  const chapterIds = new Set();
  if (!Array.isArray(doc.chapters)) { r.err('chapters', 'must be an array'); return r.done(); }
  for (const [i, c] of doc.chapters.entries()) {
    const at = `chapters[${i}]`;
    if (!isObj(c)) { r.err(at, 'must be an object'); continue; }
    if (!c.id || typeof c.id !== 'string') r.err(`${at}.id`, 'is required');
    if (chapterIds.has(c.id)) r.err(`${at}.id`, `is a duplicate: ${c.id}`);
    chapterIds.add(c.id);
    if (!STATES.includes(c.state)) r.err(`${at}.state`, `must be one of ${STATES.join(', ')}`);
    if (c.state === 'planned') {
      if (c.src !== null) r.err(`${at}.src`, 'must be null on a planned chapter, C1.3 rule 6');
      checkBilingual(r, `${at}.title`, c.title);
      checkBilingual(r, `${at}.note`, c.note);
    } else if (!c.src || typeof c.src !== 'string') r.err(`${at}.src`, 'is required on a chapter that is not planned');
    else checkDataPath(r, `${at}.src`, c.src);

    if (Array.isArray(c.requires)) {
      if (c.requires.some((x) => typeof x !== 'string')) r.err(`${at}.requires`, 'must be an array of chapter ids');
    } else if (isObj(c.requires)) {
      if (i < 3) r.err(`${at}.requires`, 'the first three chapters must use the array form, C1.3 rule 3');
      if (!trackIds.length) r.err(`${at}.requires`, 'uses the per-track object form but the manifest declares no tracks');
      for (const id of trackIds) {
        if (!Object.prototype.hasOwnProperty.call(c.requires, id)) r.err(`${at}.requires.${id}`, 'is missing: the object form must cover every declared track');
      }
      for (const key of Object.keys(c.requires)) {
        if (!trackIds.includes(key)) r.err(`${at}.requires.${key}`, 'is not a declared track id');
      }
    } else if (c.requires !== undefined) r.err(`${at}.requires`, 'must be an array or an object keyed by track id');
  }

  // Every required id exists, and the ladder has no cycle.
  const deps = new Map();
  for (const [i, c] of doc.chapters.entries()) {
    if (!isObj(c) || !c.id) continue;
    const all = new Set();
    const req = c.requires;
    for (const id of Array.isArray(req) ? req : isObj(req) ? Object.values(req).flat() : []) {
      if (!chapterIds.has(id)) r.err(`chapters[${i}].requires`, `names "${id}", which is not a chapter in this Book`);
      else all.add(id);
    }
    deps.set(c.id, all);
  }
  const mark = new Map();
  const walk = (id, trail) => {
    if (mark.get(id) === 'done') return;
    if (mark.get(id) === 'open') return r.err('chapters', `requires forms a cycle: ${trail.concat(id).join(' -> ')}`);
    mark.set(id, 'open');
    for (const dep of deps.get(id) || []) walk(dep, trail.concat(id));
    mark.set(id, 'done');
  };
  for (const id of deps.keys()) walk(id, []);

  return { ...r.done(), transforms: Array.from(transforms), customTypes: Array.from(customTypes), dataSrcs: Array.from(dataSrcs) };
}

/**
 * books/<id>/chapters/*.json. C3.
 * Pass the manifest as `book` to also check the data permission list (C1.3
 * rule 2), the transform registry (C2.4) and custom exercise types.
 */
export function validateChapter(doc, book = null) {
  const r = report();
  if (!isObj(doc)) { r.err('/', 'is not an object'); return r.done(); }
  if (doc.format !== FORMATS.chapter) r.err('format', `must be "${FORMATS.chapter}", found ${JSON.stringify(doc.format)}`);
  if (!doc.id || typeof doc.id !== 'string') r.err('id', 'is required');
  checkBilingual(r, 'title', doc.title);
  if (doc.state !== undefined && !STATES.includes(doc.state)) r.err('state', `must be one of ${STATES.join(', ')}`);

  if (!isObj(doc.goal)) r.err('goal', 'is required: C3.4 states it as something the learner can do');
  else {
    checkBilingual(r, 'goal.statement', doc.goal.statement);
    const ev = doc.goal.evidence;
    if (ev === undefined) r.warn('goal.evidence', 'is absent, so this chapter can never be passed and cannot gate the next one (C9.3 rule 2)');
    else if (!isObj(ev)) r.err('goal.evidence', 'must be an object { skill, accuracy, min, window }');
    else {
      if (typeof ev.skill !== 'string' || !ev.skill.includes('.')) r.err('goal.evidence.skill', 'must be a dotted skill string');
      if (!(ev.accuracy > 0 && ev.accuracy <= 1)) r.err('goal.evidence.accuracy', 'must be a number greater than 0 and at most 1');
      if (!(Number.isInteger(ev.min) && ev.min > 0)) r.err('goal.evidence.min', 'must be a positive integer');
      if (!(Number.isInteger(ev.window) && ev.window > 0)) r.err('goal.evidence.window', 'must be a positive integer');
      else if (Number.isInteger(ev.min) && ev.window < ev.min) r.err('goal.evidence.window', 'is smaller than min, so the goal can never be met');
    }
  }

  const declared = book && Array.isArray(book.data) ? new Set(book.data.map((d) => d.src)) : null;
  const transforms = new Set();
  const customTypes = new Set();
  for (const m of (book && book.modules) || []) {
    for (const id of (m.provides && m.provides.transforms) || []) transforms.add(id);
    for (const id of (m.provides && m.provides.exercises) || []) customTypes.add(id);
  }
  // Files the shell itself fetches when the chapter opens. A deck src is not
  // one: the engine fetches that cross-origin, so it needs the manifest's
  // permission (C1.3 rule 2) but not a place in the chapter's data[].
  const fetched = new Set();
  const usePointer = (path, pointer, shellFetches = true) => {
    if (typeof pointer !== 'string' || !pointer) { r.err(path, 'must be a data pointer'); return; }
    const file = pointerPath(pointer);
    if (!checkDataPath(r, path, file)) return;
    if (shellFetches) fetched.add(file);
    if (declared && !declared.has(file)) {
      r.err(path, `"${file}" is not declared in the manifest's data[], so the shell refuses to resolve it (C1.3 rule 2)`);
    }
  };

  if (doc.data !== undefined) {
    if (!Array.isArray(doc.data)) r.err('data', 'must be an array of paths');
    else doc.data.forEach((src, i) => usePointer(`data[${i}]`, src));
  }

  if (!Array.isArray(doc.rungs)) { r.err('rungs', 'must be an array'); return r.done(); }
  const rungIds = new Set();
  const exerciseIds = new Set();
  for (const [ri, rung] of doc.rungs.entries()) {
    const at = `rungs[${ri}]`;
    if (!isObj(rung)) { r.err(at, 'must be an object'); continue; }
    if (!rung.id) r.err(`${at}.id`, 'is required');
    if (rungIds.has(rung.id)) r.err(`${at}.id`, `is a duplicate: ${rung.id}`);
    rungIds.add(rung.id);
    checkBilingual(r, `${at}.title`, rung.title);
    checkBilingual(r, `${at}.unlocks`, rung.unlocks, { required: false });

    for (const [pi, page] of (rung.pages || []).entries()) {
      const pat = `${at}.pages[${pi}]`;
      if (!isObj(page)) { r.err(pat, 'must be an object'); continue; }
      if (!page.id) r.err(`${pat}.id`, 'is required');
      if (!PAGE_FIELDS[page.kind]) { r.err(`${pat}.kind`, `must be one of ${Object.keys(PAGE_FIELDS).join(', ')}`); continue; }
      for (const field of PAGE_FIELDS[page.kind]) {
        if (page[field] === undefined) r.err(`${pat}.${field}`, `is required for a ${page.kind} page`);
      }
      checkBilingual(r, `${pat}.title`, page.title, { required: false });
      checkBilingual(r, `${pat}.body`, page.body, { required: false, allowArray: true });
      checkBilingual(r, `${pat}.note`, page.note, { required: false, allowArray: true });
      if (page.kind === 'callout' && !CALLOUT_TONES.includes(page.tone)) r.err(`${pat}.tone`, `must be one of ${CALLOUT_TONES.join(', ')}`);
      if (page.kind === 'table') {
        if (!Array.isArray(page.columns)) r.err(`${pat}.columns`, 'must be an array');
        else page.columns.forEach((c, ci) => checkBilingual(r, `${pat}.columns[${ci}]`, c));
        if (page.rows === undefined && page.items === undefined) r.err(`${pat}.rows`, 'a table needs rows or an items pointer');
        if (page.items !== undefined) usePointer(`${pat}.items`, page.items);
      }
      const f = page.figure;
      if (f !== undefined) {
        if (!isObj(f)) r.err(`${pat}.figure`, 'must be an object');
        else if (f.kind === 'svg') {
          usePointer(`${pat}.figure.src`, f.src);
          if (!f.render) r.err(`${pat}.figure.render`, 'is required for an svg figure: it names the renderer');
        } else if (f.kind === 'viz') {
          if (!f.builder) r.err(`${pat}.figure.builder`, 'is required for a viz figure');
        } else r.err(`${pat}.figure.kind`, 'must be "svg" or "viz"');
        checkBilingual(r, `${pat}.figure.caption`, isObj(f) ? f.caption : null, { required: false });
      }
    }

    for (const [ei, ex] of (rung.exercises || []).entries()) {
      const eat = `${at}.exercises[${ei}]`;
      if (!isObj(ex)) { r.err(eat, 'must be an object'); continue; }
      if (!ex.id) r.err(`${eat}.id`, 'is required');
      if (exerciseIds.has(ex.id)) r.err(`${eat}.id`, `is a duplicate: ${ex.id}`);
      exerciseIds.add(ex.id);
      checkBilingual(r, `${eat}.title`, ex.title, { required: false });
      // The spec itself is the exercise engine's to judge (js/exercises/spec.js),
      // so there is one definition of a usable exercise rather than two.
      for (const problem of validateExerciseSpec(ex, { transforms: [...transforms], modules: [...customTypes] })) {
        r.err(eat, problem);
      }
      // parseCompare knows the token list, so the names live in one place.
      const unknown = ex.compare === undefined ? [] : parseCompare(ex.compare).unknown;
      if (unknown.length) r.err(`${eat}.compare`, `has unknown token(s): ${unknown.join(', ')}`);
      // What the engine cannot know: whether the manifest permits these files.
      if (typeof ex.items === 'string') usePointer(`${eat}.items`, ex.items);
      if (ex.type === 'deck') {
        usePointer(`${eat}.src`, ex.src, false);
        if (ex.mode !== undefined && !['review', 'cram', 'browse'].includes(ex.mode)) r.err(`${eat}.mode`, 'must be review, cram or browse (C6.1)');
        if (ex.limit !== undefined && !(Number.isInteger(ex.limit) && ex.limit > 0)) r.err(`${eat}.limit`, 'must be a positive integer');
      }
    }
  }

  // A file the shell resolves but the chapter did not list is never fetched
  // when the chapter opens, so it resolves late or not at all (C11.6).
  const listed = new Set(Array.isArray(doc.data) ? doc.data : []);
  for (const file of fetched) {
    if (!listed.has(file)) r.warn('data', `"${file}" is used but not listed in this chapter's data[]`);
  }
  return r.done();
}

// The CLI half. Node is imported here and nowhere above, so the exports stay
// browser-importable.

async function main(argv) {
  const { readFile, readdir, stat } = await import('node:fs/promises');
  const { join, resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const site = resolve(here, '..');

  const readJson = async (f) => JSON.parse(await readFile(f, 'utf8'));
  const problems = [];
  const fail = (line) => { console.log(`  ERROR ${line}`); problems.push(line); };
  const say = (file, rep) => {
    for (const w of rep.warnings) console.log(`  warn  ${file}: ${w.path} ${w.message}`);
    for (const e of rep.errors) fail(`${file}: ${e.path} ${e.message}`);
    if (rep.ok && !rep.warnings.length) console.log(`  ok    ${file}`);
  };

  let dirs = argv.filter((a) => !a.startsWith('-'));
  const booksDir = join(site, 'books');
  let catalog = null;
  try {
    catalog = await readJson(join(booksDir, 'index.json'));
    say('books/index.json', validateCatalog(catalog));
  } catch (e) {
    if (e.code === 'ENOENT') { console.log('  no books/index.json yet, nothing to validate'); return 0; }
    console.log(`  ERROR books/index.json: ${e.message}`);
    return 1;
  }
  if (!dirs.length) {
    const listed = (catalog.books || []).filter((b) => b.state !== 'planned').map((b) => join(booksDir, b.id));
    for (const name of await readdir(booksDir)) {
      const p = join(booksDir, name);
      if ((await stat(p)).isDirectory() && !listed.includes(p)) {
        console.log(`  warn  ${p.slice(site.length + 1)}: on disk but not in books/index.json`);
      }
    }
    dirs = listed;
  }

  for (const dir of dirs) {
    const rel = resolve(dir).slice(site.length + 1);
    let manifest;
    try {
      manifest = await readJson(join(resolve(dir), 'book.json'));
    } catch (e) {
      fail(`${rel}/book.json: ${e.message}`);
      continue;
    }
    say(`${rel}/book.json`, validateManifest(manifest));
    const goals = new Map();
    const emitted = new Set();
    const decks = [];
    for (const entry of manifest.chapters || []) {
      if (!entry.src) continue;
      const file = `${rel}/${entry.src}`;
      let chapter;
      try {
        chapter = await readJson(join(site, file));
      } catch (e) {
        fail(`${file}: ${e.message}`);
        continue;
      }
      const rep = validateChapter(chapter, manifest);
      if (chapter.id !== entry.id) rep.errors.push({ path: 'id', message: `is "${chapter.id}" but the manifest entry is "${entry.id}"` });
      rep.ok = rep.errors.length === 0;
      say(file, rep);
      // C3.1 lets a chapter file carry `requires`; C1.2 puts it in the manifest,
      // and the shell reads the manifest only (js/progress.js requiresFor). Two
      // sources that disagree would gate on one and document the other.
      if (chapter.requires !== undefined && JSON.stringify(chapter.requires) !== JSON.stringify(entry.requires)) {
        console.log(`  warn  ${file}: requires differs from the manifest entry, and the shell reads the manifest (C1.2)`);
      }
      const goalSkill = chapter.goal && chapter.goal.evidence && chapter.goal.evidence.skill;
      if (goalSkill) goals.set(chapter.id, goalSkill);
      for (const rung of chapter.rungs || []) {
        for (const ex of rung.exercises || []) {
          if (!ex || typeof ex !== 'object') continue;
          if (ex.type === 'deck') decks.push({ file, chapterId: chapter.id, ex });
          else if (ex.skill) emitted.add(ex.skill);
        }
      }
    }
    // Cross-chapter: every deck exercise's skill is a name this Book reads.
    checkDeckSkills({ goals, emitted, decks, fail, warn: (m) => console.log(`  warn  ${m}`) });
    const onDisk = async (p, what) => {
      try { await stat(join(site, p)); } catch { fail(`${rel}/book.json: ${what} declares ${p}, which is not on disk`); }
    };
    // C11.2 records the licence obligation inside the data file, C11.3 renders
    // from the manifest's data[] entry, and the shell now takes the union so a
    // manifest cannot suppress an acknowledgement the file requires. That union
    // silently over-credits when the two disagree, so the disagreement is named
    // here instead of living forever.
    for (const d of manifest.data || []) {
      await onDisk(d.src, 'data[]');
      let lic = null;
      try { lic = (await readJson(join(site, d.src)))._licence || {}; } catch { continue; }
      if (lic.screen === 'required' && d.screen !== 'required') {
        fail(`${rel}/book.json: data[] declares ${d.src} as screen "${d.screen}", but its own _licence says "required" (C11.2)`);
      }
      if (lic.screen === 'none' && d.screen === 'required') {
        fail(`${rel}/book.json: data[] declares ${d.src} as screen "required", but its own _licence says "none" (C11.2)`);
      }
      if (lic.id && d.attribution && lic.id !== d.attribution) {
        fail(`${rel}/book.json: data[] credits ${d.src} to "${d.attribution}", but its own _licence id is "${lic.id}"`);
      }
    }
    for (const m of manifest.modules || []) await onDisk(join(rel, m.path), 'modules[]');
  }

  if (problems.length) { console.log(`\n${problems.length} problem(s).`); return 1; }
  console.log('\nBooks valid.');
  return 0;
}

const cli = typeof process !== 'undefined' && Array.isArray(process.argv)
  && process.argv[1] && process.argv[1].endsWith('validate-book.mjs');
if (cli) main(process.argv.slice(2)).then((code) => process.exit(code));
