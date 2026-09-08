/**
 * books/<id>/chapters/*.json: the pages a chapter draws and the exercises it
 * runs (C3).
 *
 * Two things are deliberately not decided here. Whether an exercise spec is
 * usable is the engine's own judgement (js/exercises/spec.js), which the shell
 * runs too, so a chapter that would fail to mount fails here from one
 * definition rather than two. And a page's links[] is page-links.mjs, which
 * the page renderer's https rule is written against.
 *
 * Split out of tools/validate-book.mjs on 2026-09-08, unchanged in the move.
 */

import { validateExerciseSpec, parseCompare } from '../../js/exercises/index.js';
import { checkPageLinks } from './page-links.mjs';
import {
  FORMATS, PAGE_FIELDS, STATES, CALLOUT_TONES,
  report, isObj, checkBilingual, checkDataPath, pointerPath,
} from './validate-common.mjs';

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
      // The one anchor a page may draw. https only, label required: tools/lib/page-links.mjs.
      if (page.links !== undefined) checkPageLinks(r, `${pat}.links`, page.links, checkBilingual);
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
      // Both embeds point at a file, and both are subject to data[]. quiz has
      // no mode, so that check passes it over untouched.
      if (ex.type === 'deck' || ex.type === 'quiz') {
        usePointer(`${eat}.src`, ex.src, false);
        if (ex.mode !== undefined && !['review', 'cram', 'browse'].includes(ex.mode)) r.err(`${eat}.mode`, 'must be review, cram or browse (C6.1)');
        if (ex.limit !== undefined && !(Number.isInteger(ex.limit) && ex.limit > 0)) r.err(`${eat}.limit`, 'must be a positive integer');
        // A quiz's `timed` is judged by validateExerciseSpec above, which the
        // shell runs too, so a chapter with a clock the engine would discard
        // fails here and at load time from one definition rather than two.
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
