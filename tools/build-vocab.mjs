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

/** The kana readings that apply to a given kanji form. */
function readingsFor(word, form) {
  const applies = (k) => k.appliesToKanji.includes('*') || k.appliesToKanji.includes(form);
  const kana = word.kana.filter(applies);
  const common = kana.filter((k) => k.common);
  return (common.length ? common : kana).map((k) => k.text);
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
          item = toItem(word, spec, `w_${String(seq).padStart(4, '0')}`);
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
    writeData(path.join(SITE, 'data', 'vocab', slice.file), doc, slice.budget_kb);
  }

  if (missing.length) {
    process.stderr.write(`\n${missing.length} selections did not resolve:\n`);
    for (const m of missing) process.stderr.write(`  ${m}\n`);
    process.exitCode = 1;
  }
  process.stdout.write(`${n} vocabulary items from ${SOURCES.jmdict.name} ${SOURCES.jmdict.release}\n`);
}

main();
