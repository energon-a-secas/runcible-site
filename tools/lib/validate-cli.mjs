/**
 * The CLI half: walk books/, read every file the catalog and each manifest
 * name, and print one line per file. `make validate` runs this.
 *
 * What lives here rather than in the three document checkers is everything
 * that needs the disk open: a declared file that is not there, a chapter id
 * that disagrees with its manifest entry, a licence block that disagrees with
 * the manifest crediting it, a quiz filter counted against the set it filters,
 * and the cross-chapter skill rule (deck-skills.mjs). A document checker is
 * handed a parsed object and can answer without a filesystem, which is what
 * lets the shell and the runcible-book skill run the same checks.
 *
 * Node is imported inside main(), never at the top, and the entry file loads
 * this module only when it is being run as a program, so a browser importing
 * tools/validate-book.mjs never fetches it.
 *
 * Split out of tools/validate-book.mjs on 2026-09-08, unchanged in the move.
 */

import { parseQuizFilter } from '../../js/exercises/index.js';
import { checkDeckSkills } from './deck-skills.mjs';
import { validateCatalog } from './validate-catalog.mjs';
import { validateManifest } from './validate-manifest.mjs';
import { validateChapter } from './validate-chapter.mjs';

// A filtered quiz round has to be worth starting, and a filter matching nothing
// is the engine's filter-empty showing up on a learner's screen instead of at a
// build. Four is the floor because a pairs board is four pairs, so a filter
// feeding pairs that matches fewer cannot fill one board. The other three games
// ask one item at a time, and the set format ships a kana row whole even when it
// is short ("a genuinely short row is not a hole (y has three)"), so a flat four
// would refuse ya yu yo, which is a real row and a real drill. Two is a coin
// flip in any game. The grammar is checked without the file (spec.js); this is
// the half that needs the set open, so it is checked below in main().
const MIN_FILTER_MATCHES = Object.freeze({ pairs: 4, beats: 3, sound: 3, order: 3 });
const filterFloor = (game) => MIN_FILTER_MATCHES[game] || 4;

export async function main(argv) {
  const { readFile, readdir, stat } = await import('node:fs/promises');
  const { join, resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  // tools/lib -> the site root. Two levels, not one: this used to sit in
  // tools/validate-book.mjs and the first run after the split reported "no
  // books/index.json yet" because it was looking inside tools/.
  const site = resolve(here, '..', '..');

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
    const filtered = [];
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
          // Both embeds record under their spec's skill, so both are subject
          // to the skill rule, and neither counts as a reader of a skill.
          if (ex.type === 'deck' || ex.type === 'quiz') {
            decks.push({ file, chapterId: chapter.id, ex });
            if (ex.type === 'quiz' && ex.filter !== undefined) filtered.push({ file, ex });
          } else if (ex.skill) emitted.add(ex.skill);
        }
      }
    }
    // Cross-chapter: every embed's skill is a name this Book reads.
    checkDeckSkills({ goals, emitted, decks, fail, warn: (m) => console.log(`  warn  ${m}`) });
    // A quiz filter, against the set it filters. The grammar was already read
    // by the spec checker; what only the CLI can do is open the set and count.
    // The engine answers a filter that matches nothing with filter-empty, on
    // the learner's screen, with the round never starting: the whole point of
    // this check is that such a round can never be published.
    for (const { file, ex } of filtered) {
      const { field, values, problem } = parseQuizFilter(ex.filter);
      if (problem) continue; // already reported by the spec checker
      let set;
      try {
        set = await readJson(join(site, ex.src));
      } catch (e) {
        // Not on disk, or not JSON. A quiz src must be declared in data[], and
        // data[] is checked against the disk below, so this is that error
        // twice; say what went unchecked rather than repeat it.
        console.log(`  warn  ${file}: ${ex.id} filter "${ex.filter}" was not checked, ${ex.src} could not be read`);
        continue;
      }
      const items = Array.isArray(set.items) ? set.items : [];
      const wanted = new Set(values);
      const hits = items.filter((it) => it && typeof it === 'object'
        && typeof it[field] === 'string' && wanted.has(it[field].trim())).length;
      const floor = filterFloor(ex.game);
      if (hits < floor) {
        const seen = [...new Set(items.map((it) => (it && typeof it[field] === 'string' ? it[field].trim() : null)).filter(Boolean))];
        fail(`${file}: ${ex.id} filter "${ex.filter}" matches ${hits} item(s) of ${ex.src}, and a ${ex.game} round needs at least ${floor}`
          + (seen.length ? `. That set's ${field} labels are: ${seen.join(', ')}` : `. No item of that set carries a ${field}`));
      }
      if (field === 'group' && hits >= floor) {
        // The round header prints the set's own words for a group. Without
        // them it prints the label, which is a build-time label, not English.
        const named = set.groups && typeof set.groups === 'object'
          ? values.filter((v) => set.groups[v] === undefined) : values;
        if (named.length) {
          console.log(`  warn  ${file}: ${ex.id} filters on group ${named.join(', ')}, which ${ex.src} does not name in its groups{}, so the round header shows the label`);
        }
      }
    }
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
