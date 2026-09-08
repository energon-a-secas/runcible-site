#!/usr/bin/env node
/**
 * data/kanji/phon-groups.json: the joyo kanji grouped by the part that carries
 * the sound, measured rather than asserted.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 * Run it by hand, commit the output, never wire it into CI or `make serve`:
 *
 *   node tools/build-phon.mjs
 *
 * KanjiVG records a `kvg:phon` attribute on the group of strokes that is the
 * phonetic component of a character: the SVG for the river-and-work character
 * says its right half is the work character, acting as the sound. That is the
 * only claim this file makes on its own. Everything else is arithmetic over
 * KANJIDIC's on-readings: how many members of a group share one reading, and
 * therefore how good the bet is.
 *
 * WHY THE WHOLE JOYO AND NOT THE 240 TAUGHT KANJI. Grouping inside 240
 * characters gives groups of one and two and leaves no member the learner has
 * not already met, which turns a drill about a bet into a drill about memory.
 * The interesting item is a character the learner has never seen, sitting in a
 * group whose anchor they know. So the grouping runs over all 2,136 joyo, and a
 * group is kept only when the learner has an anchor in it: the phonetic
 * component itself is one of the taught sets, or one of its members is.
 *
 * TWO FRAGMENTS, PLUS A SUMMARY.
 *   #groups   every member of every kept group, for a table page.
 *   #unseen   the members the learner has NOT been taught, for the drill. A
 *             `choice` cannot filter on a field, so the filtered list has to be
 *             its own fragment.
 *   #summary  one row per group, carrying the measured hit rate, so that the
 *             chapter page states a number this file computed instead of a
 *             number somebody typed.
 *
 * WHY `on` IS A STRING AND `readings` IS THE ARRAY. KANJIDIC gives a character
 * every on-reading it has, and the work character has two. `displayValue`
 * joins an array with a space, so an array answer renders as one run-together
 * option nobody would pick and no dictionary lists. `on` is therefore the one
 * reading the item is asked for: the reading its group shares when the
 * character has it, and the character's own first reading when it does not.
 * That difference is the whole point of the drill and `fits` records it.
 *
 * The licence is EDRDG's, because the readings, the grades and the joyo
 * membership are KANJIDIC's. The grouping is KanjiVG's and is named in
 * `upstream`. Both notices reach the screen because the chapter that renders
 * this file also declares a KanjiVG stroke file in the manifest's `data[]`, and
 * the shell unions a chapter's declarations. One `_licence` object, never an
 * array: js/books.js and tools/validate-book.mjs both read it as one object, so
 * an array would blank the id, the screen flag and the acknowledgement.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadKanjiVgDir, SOURCES } from './lib/sources.mjs';
import { SITE, licenceBlock, writeData } from './lib/corpus.mjs';
import { kanjidic, kanjiSelection, resolveSet, setById } from './lib/kanjisets.mjs';

const TOOL = 'tools/build-phon.mjs';
const PHON = /kvg:phon="([^"]+)"/g;

/**
 * One character is emitted as a \uXXXX escape rather than as itself, and the
 * reason is in tools/lib/corpus.mjs beside `escapeChars`: check-licence.mjs
 * bans it outright because a 1941 song's whole title is that single character,
 * and KANJIDIC puts the same character in grade 2, inside one of these groups.
 * It is written here as an escape too, so this file does not spell it out.
 */
const ESCAPE = ['\u6d77'];

/** Hex codepoints of a string, for an ASCII id that is stable across edits. */
function hex(s) {
  return [...s].map((c) => c.codePointAt(0).toString(16)).join('');
}

/**
 * KanjiVG numbers a phonetic component when a character draws it in a variant
 * shape: the metal character carries the "now" component twice, once per
 * variant, and the night character carries a third. Those suffixes describe the
 * drawing, not the sound, so they are stripped and the variants are one group.
 * Leaving them apart would split a real group into pieces of one member each,
 * and the size floor would then drop every piece.
 */
function normalise(key) {
  const stripped = key.replace(/[0-9VT]+$/, '');
  return stripped || key;
}

function onReadings(character) {
  const out = [];
  for (const group of character.readingMeaning?.groups || []) {
    for (const r of group.readings) if (r.type === 'ja_on') out.push(r.value);
  }
  return [...new Set(out)];
}

function svgFile(dir, char) {
  return path.join(dir, `${char.codePointAt(0).toString(16).padStart(5, '0')}.svg`);
}

/** Every distinct phonetic component KanjiVG records for one character. */
function phonOf(dir, char) {
  const file = svgFile(dir, char);
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  PHON.lastIndex = 0;
  const found = new Set();
  let m = PHON.exec(text);
  while (m) { found.add(normalise(m[1])); m = PHON.exec(text); }
  return [...found];
}

/**
 * The reading a group shares: the one the most members carry. A tie is broken
 * toward a reading the phonetic component itself has, and then alphabetically,
 * so the answer key never depends on the order KANJIDIC happens to list
 * characters in.
 */
function sharedReading(members, key, onOf) {
  const count = new Map();
  for (const ch of members) {
    for (const r of onOf.get(ch) || []) count.set(r, (count.get(r) || 0) + 1);
  }
  if (!count.size) return null;
  const top = Math.max(...count.values());
  const tied = [...count.entries()].filter(([, n]) => n === top).map(([r]) => r).sort();
  const own = onOf.get(key) || [];
  return { on: tied.find((r) => own.includes(r)) ?? tied[0], hit: top };
}

function main() {
  const sel = kanjiSelection();
  const cfg = sel.phon;
  if (!cfg) {
    process.stderr.write('tools/selection/kanji.json has no "phon" block\n');
    process.exit(1);
  }
  const dir = loadKanjiVgDir();
  const dict = kanjidic();

  const grades = new Set(cfg.grades);
  const joyo = dict.characters.filter((c) => grades.has(c.misc.grade));
  const gradeOf = new Map(joyo.map((c) => [c.literal, c.misc.grade]));
  const onOf = new Map(joyo.map((c) => [c.literal, onReadings(c)]));

  const taught = new Set();
  for (const id of cfg.taught_sets) for (const lit of resolveSet(setById(id))) taught.add(lit);
  const taughtGrades = [...new Set([...taught].map((c) => gradeOf.get(c)))].sort();
  process.stdout.write(
    `${joyo.length} joyo kanji from ${SOURCES.kanjidic.name} ${SOURCES.kanjidic.release}\n`
    + `${taught.size} taught, from ${cfg.taught_sets.join(', ')} (grades ${taughtGrades.join(' and ')})\n`);

  // Group the whole joyo by phonetic component.
  const buckets = new Map();
  let missingSvg = 0;
  for (const c of joyo) {
    if (!fs.existsSync(svgFile(dir, c.literal))) { missingSvg += 1; continue; }
    for (const key of phonOf(dir, c.literal)) {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c.literal);
    }
  }
  if (missingSvg) {
    process.stderr.write(`${missingSvg} joyo kanji have no KanjiVG file\n`);
    process.exitCode = 1;
  }

  const dropped = { small: 0, unanchored: 0, noReading: 0 };
  const kept = [];
  for (const [key, members] of buckets) {
    if (members.length < cfg.min_group) { dropped.small += 1; continue; }
    if (!taught.has(key) && !members.some((c) => taught.has(c))) { dropped.unanchored += 1; continue; }
    const shared = sharedReading(members, key, onOf);
    if (!shared) { dropped.noReading += 1; continue; }
    kept.push({ key, members: members.slice().sort(), ...shared });
  }
  kept.sort((a, b) => b.members.length - a.members.length || a.key.localeCompare(b.key));

  const groups = [];
  const unseen = [];
  const summary = [];
  let multiReading = 0;
  for (const g of kept) {
    const anchors = g.members.filter((c) => taught.has(c));
    for (const literal of g.members) {
      const readings = onOf.get(literal) || [];
      const fits = readings.includes(g.on);
      const row = {
        id: `p_${hex(literal)}_${hex(g.key)}`,
        group: g.key,
        literal,
        on: fits ? g.on : readings[0],
        readings,
        grade: gradeOf.get(literal),
        known: taught.has(literal),
        fits,
      };
      if (row.on === undefined) delete row.on;
      groups.push(row);
      if (row.known || row.on === undefined) continue;
      // A character with two on-readings cannot be asked as a single-answer
      // multiple choice here. `choice` builds its wrong options from the
      // answers of the other items in the same pool, and this pool is 66
      // readings wide, so the second reading of the very character being asked
      // can appear as a wrong option. The learner would then be marked wrong
      // for naming a reading KANJIDIC lists. Keeping the drill honest costs 37
      // of 197 candidates and leaves 52 of the 54 groups represented.
      if (readings.length > 1) { multiReading += 1; continue; }
      unseen.push({
        id: row.id, group: g.key, literal, on: row.on, grade: row.grade, fits,
      });
    }
    summary.push({
      id: `g_${hex(g.key)}`,
      group: g.key,
      on: g.on,
      n: g.members.length,
      hit: g.hit,
      pct: Math.round((100 * g.hit) / g.members.length),
      members: g.members.join(''),
      anchors: anchors.join(''),
      element_known: taught.has(g.key),
    });
  }

  const distinctOn = new Set(unseen.map((r) => r.on));
  const betHolds = unseen.filter((r) => r.fits).length;

  const doc = {
    _licence: licenceBlock('edrdg', TOOL, {
      upstream: `${SOURCES.kanjidic.name} ${SOURCES.kanjidic.release}`
        + `, grouped by the phonetic component recorded in ${SOURCES.kanjivg.name} ${SOURCES.kanjivg.release}`,
    }),
    format: 'neo-phon/1',
    set: cfg.id,
    chapter: cfg.chapter,
    title: cfg.title,
    counts: {
      groups: summary.length,
      members: groups.length,
      unseen: unseen.length,
      taught: taught.size,
      distinct_on: distinctOn.size,
      bet_holds: betHolds,
      bet_rate: Math.round((100 * betHolds) / (unseen.length || 1)),
    },
    summary,
    groups,
    unseen,
  };

  writeData(path.join(SITE, 'data', ...cfg.out.split('/')), doc, cfg.budget_kb, ESCAPE);

  process.stdout.write(
    `${summary.length} groups, ${groups.length} members, `
    + `${unseen.length} unseen (${multiReading} held back for carrying more than one on-reading)\n`
    + `smallest group ${Math.min(...summary.map((r) => r.n))}, `
    + `every group has an anchor, dropped ${dropped.small} under ${cfg.min_group} `
    + `and ${dropped.unanchored} with no taught anchor\n`
    + `#unseen carries ${distinctOn.size} distinct on-readings; `
    + `the phonetic bet holds for ${betHolds} of ${unseen.length} (${doc.counts.bet_rate} percent)\n`);

  // The three assertions the plan names, checked rather than assumed.
  const small = summary.filter((r) => r.n < cfg.min_group);
  if (small.length) {
    process.stderr.write(`${small.length} groups are under ${cfg.min_group} members\n`);
    process.exitCode = 1;
  }
  const loose = summary.filter((r) => !r.element_known && !r.anchors);
  if (loose.length) {
    process.stderr.write(`${loose.length} groups have no taught anchor: ${loose.map((r) => r.group).join(' ')}\n`);
    process.exitCode = 1;
  }
  if (distinctOn.size < cfg.min_distinct_on) {
    process.stderr.write(
      `#unseen carries ${distinctOn.size} distinct on-readings, under the floor of ${cfg.min_distinct_on}. `
      + 'A choice round cannot build wrong options from a pool this narrow.\n');
    process.exitCode = 1;
  }
}

main();
