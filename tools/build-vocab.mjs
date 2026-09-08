#!/usr/bin/env node
/**
 * data/vocab/<chapter>.json, sliced out of jmdict-eng-common.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 * Run it by hand, commit the output, never wire it into CI or `make serve`:
 *
 *   node tools/build-vocab.mjs
 *
 * The full dump is 1.4 MB compressed and 16 MB parsed and is never shipped
 * (CONTRACTS C11.6). What ships is a chapter-keyed slice of the words the
 * chapter actually teaches, selected by tools/selection/vocab.json.
 *
 * Derived data inherits the source licence. This output is CC BY-SA 4.0, not
 * the repo's MIT, and carries the EDRDG acknowledgement in its `_licence`
 * block with `screen: "required"`, which is what makes the shell render the
 * acknowledgement on every screen that shows one of these words.
 */
import path from 'node:path';
import { loadZippedJson, SOURCES } from './lib/sources.mjs';
import {
  SITE, licenceBlock, readSelection, writeData, hasBannedDash,
} from './lib/corpus.mjs';
import { resolveSet, setById } from './lib/kanjisets.mjs';

const TOOL = 'tools/build-vocab.mjs';
const MAX_SENSES = 2;
const MAX_GLOSSES = 3;

/**
 * One character is emitted as a \uXXXX escape rather than as itself, and the
 * reason is in tools/lib/corpus.mjs beside `escapeChars`: check-licence.mjs
 * bans it outright because a 1941 song's whole title is that one character,
 * and KANJIDIC puts the same character in grade 2, so a grade 2 vocabulary
 * slice carries it as a headword the generator did not choose. It is written
 * here as an escape too, so this file does not spell it out either. The parsed
 * value is identical; only the bytes on disk change, and a file with no
 * occurrence is byte-identical to what it was before.
 */
const ESCAPE = ['\u6d77'];

/**
 * The JMdict misc tags the Book's drills read, and the only ones emitted.
 * Everything else JMdict tags a sense with (`arch`, `sl`, `derog`, ...) is
 * dropped, because a field a drill can answer should hold what the drill
 * teaches and not the whole dictionary's editorial apparatus.
 */
const TRACKED_MISC = ['uk', 'on-mim', 'hon', 'hum', 'pol', 'col'];

/** Fields a group may ask for with `emit`. `situation` and `set` are authored. */
const EMITTABLE = ['misc', 'spelling', 'script', 'shape', 'register'];

const ALL_KATAKANA = /^[\u30A1-\u30FA\u30FC]+$/;

function indexForms(dict) {
  const byForm = new Map();
  const push = (text, word) => {
    if (!byForm.has(text)) byForm.set(text, []);
    byForm.get(text).push(word);
  };
  for (const w of dict.words) {
    for (const k of w.kanji) push(k.text, w);
    for (const k of w.kana) push(k.text, w);
  }
  return byForm;
}

/** The kana rows that apply to a given kanji form, common ones if any are. */
function readingRows(word, form) {
  const applies = (k) => k.appliesToKanji.includes('*') || k.appliesToKanji.includes(form);
  const kana = word.kana.filter(applies);
  const common = kana.filter((k) => k.common);
  return common.length ? common : kana;
}

/** The kana readings that apply to a given kanji form. */
function readingsFor(word, form) {
  return readingRows(word, form).map((k) => k.text);
}

/**
 * Every reading a `typed` drill over this word should mark right.
 *
 * A word can be read two ways and both are correct: the day after this one is
 * あした or あす, and four counts as よん or し. A drill that knows one of them
 * marks a learner wrong for reading the dictionary correctly, which is why two
 * shipped exercises answer against this field rather than against `kana`
 * (`4-first-words.json` e-days-type, `6-kanji.json` e-compounds-reading).
 *
 * Where JMdict marks some readings `gikun`, those are the word's own readings
 * and the rest are the reading of its characters, so the gikun ones win: today
 * is きょう and not こんにち, tomorrow is あした or あす and not みょうにち.
 * The chapter's stated reading comes first, then the others in JMdict order,
 * capped at two, because a drill that lists five is a drill nobody can fail.
 *
 * Emitted only where the selection asks, per group or per word, because the
 * field's whole purpose is to be the `answer` of a drill: a group where half
 * the items carry it is a drill with blank answers in it.
 */
function acceptFor(word, form, reading) {
  const rows = readingRows(word, form);
  const gikun = rows.filter((k) => (k.tags || []).includes('gikun'));
  const texts = (gikun.length ? gikun : rows).map((k) => k.text);
  const ordered = reading ? [reading, ...texts.filter((t) => t !== reading)] : texts;
  return ordered.slice(0, 2);
}

function glossesFor(word, pos) {
  const senses = word.sense.filter((s) => !pos || s.partOfSpeech.includes(pos));
  const use = (senses.length ? senses : word.sense).slice(0, MAX_SENSES);
  return use.map((s) => s.gloss.slice(0, MAX_GLOSSES).map((g) => g.text).join('; '));
}

function pickEntry(byForm, spec) {
  const hits = byForm.get(spec.q) || [];
  if (spec.jmdict) {
    // A form plus a part of speech can still name three different verbs: いる
    // is 射る, 居る and 鋳る, all v1, and the first one won by accident. The
    // JMdict entry id is the only thing that says which one a chapter means.
    // A pin that resolves to nothing is reported as missing rather than
    // quietly falling back, because a stale pin is exactly what this prevents.
    return hits.find((w) => w.id === spec.jmdict) || null;
  }
  let matches = hits.filter((w) => !spec.pos
    || w.sense.some((s) => s.partOfSpeech.includes(spec.pos)));
  if (spec.reading) {
    // A form plus a part of speech is still ambiguous: 本 is a counter twice
    // over, once read もと and once ほん. The stated reading decides.
    const withReading = matches.filter((w) => w.kana.some((k) => k.text === spec.reading));
    if (withReading.length) matches = withReading;
  }
  if (!matches.length) return null;
  // Prefer the entry where the queried form is marked common, then the first.
  const commonFirst = matches.filter((w) => [...w.kanji, ...w.kana]
    .some((f) => f.text === spec.q && f.common));
  return (commonFirst[0] || matches[0]);
}

/** The tracked JMdict misc tags carried by any sense of the entry. */
function miscOf(word) {
  const seen = new Set(word.sense.flatMap((sense) => sense.misc || []));
  return TRACKED_MISC.filter((tag) => seen.has(tag));
}

/**
 * Which of the three scripts a real text would use for this word.
 *
 * Three buckets, tested in this order:
 *
 *   1. katakana, when any kana form marked common is written entirely in
 *      katakana. This has to come first: the naive rule ("hiragana when `uk`")
 *      labels the mouse hiragana, and its common kana form is katakana.
 *   2. hiragana, when the entry is `uk` or has no kanji form at all and what
 *      is left is hiragana.
 *   3. kanji otherwise.
 *
 * The plan's rule opened with "katakana when the entry has no kanji form",
 * which is right for the loanwords it was written against and wrong for a
 * kana-only hiragana word (もしもし has no kanji form and is not katakana).
 * Bucket 1 answers the loanwords the same way and bucket 2 answers the rest,
 * so every word the plan names lands where the plan says it does. A rule keyed
 * on `appliesToKanji: []` would label the coffee entry kanji, since its common
 * kana form applies to `['*']` as 158 other `uk` entries do.
 */
function scriptOf(word) {
  const common = word.kana.filter((k) => k.common);
  const kana = (common.length ? common : word.kana).map((k) => k.text);
  if (kana.some((text) => ALL_KATAKANA.test(text))) return 'katakana';
  const uk = word.sense.some((sense) => (sense.misc || []).includes('uk'));
  if (uk || !word.kanji.length) return 'hiragana';
  return 'kanji';
}

/**
 * The mimetic's shape, read off the kana rather than listed by hand.
 *
 * Four endings, because the fifth family the chapter teaches is voicing
 * (きらきら beside ぎらぎら), which is a property of the first mora and not of
 * the ending, and both members of a voiced pair have the same shape.
 *
 * `null` for a word that fits none of them, which the caller reports and drops:
 * an item whose answer is "other" teaches the learner nothing about the shape.
 * The sokuon family appears in a dictionary with the adverbial と attached
 * (じっと, not じっ), and the same is true of the final ん family, so both
 * endings are matched with and without it.
 */
function shapeOf(kana) {
  const n = kana.length;
  if (n % 2 === 0 && n > 2 && kana.slice(0, n / 2) === kana.slice(n / 2)) return 'reduplicated';
  if (kana.endsWith('\u3063') || kana.endsWith('\u3063\u3068')) return 'sokuon-final';
  if (kana.endsWith('\u308a')) return 'ri-final';
  if (kana.endsWith('\u3093') || kana.endsWith('\u3093\u3068')) return 'n-final';
  return null;
}

/**
 * One politeness label per word, by precedence, because JMdict tags a sense
 * and not a word: the humble verb for receiving carries both `hum` and `pol`,
 * and a drill whose answer is a list renders the two run together.
 */
function registerOf(misc) {
  if (misc.includes('hon')) return 'hon';
  if (misc.includes('hum')) return 'hum';
  if (misc.includes('pol')) return 'pol';
  return 'plain';
}

/**
 * The derived and authored fields a group asked for, added to a finished item.
 *
 * Emission is per group rather than per file, and that is deliberate: a field
 * is emitted for the exercise that reads it, so the selection file says which
 * drill needs which field, and every slice built before these fields existed
 * emits exactly the bytes it emitted before.
 */
function decorate(item, word, spec, group) {
  if (group.accept || spec.accept) item.accept = acceptFor(word, item.word, spec.reading);
  const want = new Set(group.emit || []);
  for (const field of want) {
    if (!EMITTABLE.includes(field)) {
      throw new Error(`group ${group.id}: "${field}" is not one of ${EMITTABLE.join(', ')}`);
    }
  }
  const misc = miscOf(word);
  if (want.has('misc')) item.misc = misc;
  if (want.has('spelling')) item.spelling = misc.includes('uk') ? 'kana' : 'kanji';
  if (want.has('script')) item.script = scriptOf(word);
  if (want.has('register')) item.register = registerOf(misc);
  if (want.has('shape')) {
    const shape = shapeOf(item.kana);
    if (!shape) throw new Error(`${spec.q}: kana ${item.kana} fits none of the mimetic families`);
    item.shape = shape;
  }
  // Authored, passed through untouched: a label the selection file wrote, never
  // a gloss, and never invented by this generator.
  if (spec.situation) item.situation = spec.situation;
  if (spec.set) item.set = spec.set;
  return item;
}

/**
 * The three per-group assertions the build plan asks for, run over the items a
 * group actually resolved to rather than over the list it was given, because
 * a dropped gloss is exactly how a group of six becomes a group of five.
 */
function checkGroup(group, items, file) {
  const problems = [];
  if (Number.isFinite(group.min_items) && items.length < group.min_items) {
    problems.push(`${file} ${group.id}: ${items.length} items, the floor is ${group.min_items}`);
  }
  // A homophones group whose two spellings are one JMdict entry is a coin
  // flip: the same record, the same gloss, two labels, and no right answer.
  if (group.distinct_entries || group.id === 'homophones') {
    const byId = new Map();
    for (const item of items) {
      const seen = byId.get(item.jmdict);
      if (seen) {
        problems.push(
          `${file} ${group.id}: ${item.word} and ${seen} are both JMdict ${item.jmdict}`);
      } else byId.set(item.jmdict, item.word);
    }
  }
  for (const [field, values] of Object.entries(group.require_values || {})) {
    const got = new Set(items.map((item) => item[field]));
    const gap = values.filter((v) => !got.has(v));
    if (gap.length) {
      problems.push(`${file} ${group.id}: no item has ${field} ${gap.join(' or ')}`);
    }
  }
  return problems;
}

function toItem(word, spec, id) {
  const isKanjiForm = word.kanji.some((k) => k.text === spec.q);
  const headword = spec.q;
  let kana;
  if (spec.reading) {
    kana = spec.reading;
    const known = word.kana.map((k) => k.text);
    if (!known.includes(kana)) {
      throw new Error(`${spec.q}: reading ${kana} is not in JMdict ${word.id} (${known.join('/')})`);
    }
  } else if (isKanjiForm) {
    kana = readingsFor(word, headword)[0];
  } else {
    kana = headword;
  }
  const gloss = glossesFor(word, spec.pos);
  const pos = [...new Set(word.sense.flatMap((s) => s.partOfSpeech))];
  const item = {
    id,
    word: headword,
    kana,
    gloss,
    pos: spec.pos ? [spec.pos, ...pos.filter((p) => p !== spec.pos)].slice(0, 3) : pos.slice(0, 3),
    jmdict: word.id,
  };
  if (isKanjiForm && kana !== headword) item.has_kanji = true;
  return item;
}

/**
 * One word per kanji of a named set, read out of JMdict rather than listed by
 * hand, so the vocabulary cannot name a character the kanji table does not
 * have. `overrides` steers the handful where JMdict's first sense is not the
 * one a beginner should meet, and `exclude` drops the ones where no standalone
 * word is worth teaching.
 */
function autoSingleKanji(byForm, auto, seen) {
  const literals = resolveSet(setById(auto.single_kanji_from_set));
  const skip = new Set(auto.exclude || []);
  const out = [];
  for (const lit of literals) {
    if (skip.has(lit) || seen.has(lit)) continue;
    const override = (auto.overrides || {})[lit];
    if (override) { out.push({ q: lit, ...override }); continue; }
    const hits = (byForm.get(lit) || []).filter((w) => w.kanji.some((k) => k.text === lit && k.common)
      && w.sense.some((s) => s.partOfSpeech.some((p) => /^(n|v|adj|num|pn|ctr)/.test(p))));
    if (!hits.length) continue;
    out.push({ q: lit, _word: hits[0] });
  }
  return out;
}

function main() {
  const dict = loadZippedJson('jmdict');
  const byForm = indexForms(dict);
  const sel = readSelection('vocab.json');
  const missing = [];
  const counts = [];
  let n = 0;

  for (const slice of sel.slices) {
    const groups = {};
    const order = [];
    const labels = {};
    const seen = new Set();
    let seq = 0;

    for (const group of slice.groups) {
      const specs = group.auto
        ? autoSingleKanji(byForm, group.auto, seen)
        : group.words;
      const items = [];
      for (const spec of specs) {
        const word = spec._word || pickEntry(byForm, spec);
        if (!word) {
          if (!spec.optional) missing.push(`${slice.file} ${group.id} ${spec.q}`);
          continue;
        }
        seq += 1;
        let item;
        try {
          item = decorate(
            toItem(word, spec, `w_${String(seq).padStart(4, '0')}`), word, spec, group);
        } catch (err) {
          missing.push(`${slice.file} ${group.id} ${err.message}`);
          continue;
        }
        if (item.gloss.some(hasBannedDash)) {
          // The house rule reaches JSON string values. A gloss carrying the
          // banned character is dropped rather than rewritten: rewriting a
          // dictionary gloss is editing somebody else's dictionary.
          item.gloss = item.gloss.filter((g) => !hasBannedDash(g));
          if (!item.gloss.length) { missing.push(`${slice.file} ${group.id} ${spec.q} (gloss dropped)`); continue; }
        }
        seen.add(item.word);
        items.push(item);
      }
      groups[group.id] = items;
      labels[group.id] = group.label;
      order.push(group.id);
      n += items.length;
      missing.push(...checkGroup(group, items, slice.file));
      counts.push(`  ${slice.file.padEnd(11)} ${group.id.padEnd(14)} ${String(items.length).padStart(3)}`);
    }

    const doc = {
      _licence: licenceBlock('edrdg', TOOL, {
        upstream: `${SOURCES.jmdict.name} ${SOURCES.jmdict.release}`,
      }),
      format: 'neo-vocab/1',
      chapter: slice.chapter,
      title: slice.title,
      order,
      labels,
      count: Object.values(groups).reduce((a, g) => a + g.length, 0),
      groups,
    };
    writeData(path.join(SITE, 'data', 'vocab', slice.file), doc, slice.budget_kb, ESCAPE);
  }

  if (missing.length) {
    process.stderr.write(`\n${missing.length} selections did not resolve:\n`);
    for (const m of missing) process.stderr.write(`  ${m}\n`);
    process.exitCode = 1;
  }
  process.stdout.write(`${counts.join('\n')}\n`);
  process.stdout.write(`${n} vocabulary items from ${SOURCES.jmdict.name} ${SOURCES.jmdict.release}\n`);
}

main();
