/**
 * books/<id>/book.json: the ladder, the tracks, the data permission list, the
 * credits and the Book modules (C1.2 and C1.3).
 *
 * The manifest is where a Book states what it may fetch and what it may
 * register, so most of what this file refuses is a Book reaching past its own
 * declaration. It also walks `requires` for a cycle, because a ladder that
 * loops locks every chapter in the loop with no error anywhere.
 *
 * Split out of tools/validate-book.mjs on 2026-09-08, unchanged in the move.
 */

import { checkRegisteredId } from '../../js/exercises/index.js';
import { FORMATS, STATES, SLUG, DATE, report, isObj, checkBilingual, checkDataPath } from './validate-common.mjs';

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
