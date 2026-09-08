#!/usr/bin/env node
/**
 * data/piano/pieces-*.json, read out of the Mutopia Project's own engravings.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 * Run it by hand, read the numbers it prints, commit the output:
 *
 *   node tools/build-piano.mjs
 *
 * Two things are read from upstream and neither is ever typed by a person.
 *
 * 1. The licence. Every Mutopia piece carries its own `.rdf` with an
 *    `<mp:licence>` tag and an `<mp:maintainer>`, and Mutopia licenses per
 *    piece rather than per composer. This script reads that tag and maps it to
 *    an SPDX id from a closed table; an unmapped tag stops the run. A file's
 *    `_licence` block is one object (C11.2), so it can name one licence and one
 *    engraver: the run asserts that every piece written into one file agrees on
 *    both, and says which file to split when they do not.
 *
 * 2. The notes. The `.ly` source carries the spelling the score prints, so
 *    F sharp arrives as `fis` and never has to be guessed back out of a pitch
 *    number. The reader below is deliberately narrow: it follows one named
 *    staff, and it keeps a bar only when that bar holds no chord, no polyphony
 *    block, no grace note, no tuplet and no ottava bracket, and only when the
 *    written durations add up to the time signature exactly. That last check is
 *    the one that matters: a bar the reader misread almost never adds up, so a
 *    misreading is dropped rather than shipped. Everything dropped is counted
 *    and printed, per piece, and lands in the file as `read.refused`.
 *
 * What this means for the Book: a piece whose upper staff is chordal, or whose
 * source marks bars with comments instead of bar checks, ships with its licence
 * and its credits and with no drillable bar at all. That is a named gap in
 * chapter 4, not a silent one, and `readable: false` is what names it.
 *
 * Nothing is hot-linked. The `.rdf` and `.ly` land in the same cache the other
 * builders use, outside the repository, and only the derived JSON is committed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { SITE, writeData, readSelection, fmtBytes } from './lib/corpus.mjs';

const TOOL = 'tools/build-piano.mjs';
const GENERATED_AT = '2026-09-08';
const CACHE = path.join(process.env.RUNCIBLE_CACHE || path.join(os.tmpdir(), 'runcible-corpus-cache'), 'mutopia');
const BUDGET_KB = 60;

/** Mutopia's licence tags, and the only ones this corpus accepts. */
const SPDX = {
  'Public Domain': 'public-domain',
  'Creative Commons Attribution-ShareAlike 2.5': 'CC-BY-SA-2.5',
  'Creative Commons Attribution-ShareAlike 3.0': 'CC-BY-SA-3.0',
  'Creative Commons Attribution-ShareAlike 4.0': 'CC-BY-SA-4.0',
  'Creative Commons Attribution 3.0': 'CC-BY-3.0',
  'Creative Commons Attribution 4.0': 'CC-BY-4.0',
};

const LETTERS = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
const NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const UNIT = 1024n;

/** Commands that change nothing this reader records. */
const HARMLESS = new Set([
  'break', 'noBreak', 'stemUp', 'stemDown', 'stemNeutral', 'oneVoice', 'voiceOne',
  'voiceTwo', 'voiceThree', 'mordent', 'prall', 'prallprall', 'trill', 'turn',
  'fermata', 'staccato', 'staccatissimo', 'tenuto', 'marcato', 'accent',
  'espressivo', 'cresc', 'decr', 'dim', 'f', 'ff', 'fff', 'p', 'pp', 'ppp',
  'mf', 'mp', 'sf', 'sfz', 'fp', 'rfz', 'startTrillSpan', 'stopTrillSpan',
  'arpeggio', 'upbow', 'downbow', 'noBeam', 'melisma', 'melismaEnd', 'shape',
  'sustainOn', 'sustainOff', 'bar', 'segno', 'coda', 'default', 'major', 'minor',
  'slurUp', 'slurDown', 'slurNeutral', 'tieUp', 'tieDown', 'tieNeutral',
  'phrasingSlurUp', 'phrasingSlurDown', 'dynamicUp', 'dynamicDown',
  'crescTextCresc', 'autoBeamOff', 'autoBeamOn', 'mark',
]);
/** Commands that make the bar they sit in unreadable, on purpose. */
const REFUSE = new Set(['times', 'tuplet', 'grace', 'acciaccatura', 'appoggiatura', 'afterGrace', 'transpose', 'context', 'new']);
/** Commands whose arguments run to the end of the line. */
const LINE_CMD = new Set(['set', 'unset', 'override', 'revert', 'once', 'tweak', 'tempo']);

// ── upstream ──────────────────────────────────────────────────────────────

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Download once into the cache, outside the repository. */
function fetchFile(base, dir, name) {
  fs.mkdirSync(CACHE, { recursive: true });
  const dest = path.join(CACHE, name);
  if (!fs.existsSync(dest)) {
    const url = `${base}${dir}/${name}`;
    process.stderr.write(`fetch ${url}\n`);
    execFileSync('curl', ['-sSL', '--fail', '--max-time', '120', '-o', dest, url], { stdio: 'inherit' });
  }
  return dest;
}

/** The handful of tags this corpus reads out of a Mutopia .rdf. */
function parseRdf(text) {
  const out = {};
  for (const m of text.matchAll(/<mp:([A-Za-z0-9]+)>([^<]*)<\/mp:[A-Za-z0-9]+>/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

// ── the reader ────────────────────────────────────────────────────────────

/** The text of `name = [\relative x] { ... }`, braces balanced, or null. */
export function extractBlock(text, name) {
  const re = new RegExp(`(^|\\n)\\s*${name}\\s*=\\s*`, 'm');
  const m = re.exec(text);
  if (!m) return null;
  let i = m.index + m[0].length;
  let head = '';
  const rel = /^\\relative\s+[a-g](?:is|es|s)*[',]*\s*/.exec(text.slice(i));
  if (rel) { head = rel[0]; i += rel[0].length; }
  if (text[i] !== '{') return null;
  let depth = 0;
  const start = i;
  while (i < text.length) {
    if (text[i] === '"') { i += 1; while (i < text.length && text[i] !== '"') i += 1; }
    else if (text[i] === '{') depth += 1;
    else if (text[i] === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
    i += 1;
  }
  return head + text.slice(start, i);
}

function durTicks(den, dots) {
  let add = UNIT / BigInt(den);
  let total = add;
  for (let d = 0; d < dots; d += 1) { add /= 2n; total += add; }
  return total;
}

/**
 * Walk one staff. Everything it does not recognise refuses the bar it is in,
 * which is why the unknown-token branch at the bottom is not a fallback but the
 * whole safety property.
 */
export function readVoice(src) {
  const t = src;
  let i = 0;
  const st = { key: null, time: null, clef: null, mode: 'absolute', prev: null, bars: [], ottava: false };
  let cur = null;
  let lastDur = null;
  let poly = 0;
  const startBar = () => { cur = { notes: [], ticks: 0n, refused: null }; };
  const refuse = (why) => { if (cur && !cur.refused) cur.refused = why; };
  startBar();

  const word = () => {
    const m = /^[A-Za-z][A-Za-z0-9]*/.exec(t.slice(i));
    if (!m) return null;
    i += m[0].length;
    return m[0];
  };
  const skipSpace = () => { while (i < t.length && /\s/.test(t[i])) i += 1; };
  const skipString = () => { i += 1; while (i < t.length && t[i] !== '"') i += 1; i += 1; };
  const skipLine = () => { while (i < t.length && t[i] !== '\n') i += 1; };
  const skipBalanced = (open, close) => {
    let depth = 0;
    while (i < t.length) {
      if (t[i] === open) depth += 1;
      else if (t[i] === close) { depth -= 1; i += 1; if (depth === 0) return; continue; }
      i += 1;
    }
  };

  /** A pitch, only where the next character cannot make it a longer word. */
  const looksLikePitch = () => {
    const m = /^([a-g])((?:is|es|s(?![a-z]))*)([',]*)(\d*)(\.*)([!?]?)/.exec(t.slice(i));
    return Boolean(m) && !/[a-z]/i.test(t.slice(i + m[0].length, i + m[0].length + 1));
  };

  const readPitch = () => {
    const letter = t[i];
    i += 1;
    let alter = 0;
    for (;;) {
      if (t.startsWith('is', i)) { alter += 1; i += 2; }
      else if (t.startsWith('es', i)) { alter -= 1; i += 2; }
      else if (t[i] === 's' && (letter === 'e' || letter === 'a')) { alter -= 1; i += 1; }
      else break;
    }
    let marks = 0;
    while (t[i] === "'" || t[i] === ',') { marks += t[i] === "'" ? 1 : -1; i += 1; }
    if (t[i] === '!' || t[i] === '?') i += 1;
    const d = /^(\d+)(\.*)/.exec(t.slice(i));
    let den = null;
    let dots = 0;
    if (d) { den = Number(d[1]); dots = d[2].length; i += d[0].length; }
    if (t[i] === '!' || t[i] === '?') i += 1;
    return { letter, alter, marks, den, dots };
  };

  /** LilyPond's relative rule: within a fourth of the note before, then shifted. */
  const place = (p) => {
    const step = LETTERS[p.letter];
    let idx;
    if (st.mode === 'relative' && st.prev !== null) {
      idx = step + 7 * Math.round((st.prev - step) / 7);
      while (idx - st.prev > 3) idx -= 7;
      while (st.prev - idx > 3) idx += 7;
      idx += 7 * p.marks;
    } else {
      idx = step + 7 * (3 + p.marks);
    }
    st.prev = idx;
    return { step, idx, octave: Math.floor(idx / 7), alter: p.alter };
  };

  const addNote = (p, den, dots) => {
    if (!den) { refuse('a note with no duration'); return; }
    lastDur = { den, dots };
    const placed = place(p);
    cur.ticks += durTicks(den, dots);
    if (poly > 0) refuse('polyphony');
    if (st.ottava) refuse('an ottava bracket');
    cur.notes.push({ ...placed, den, dots });
  };

  while (i < t.length) {
    const c = t[i];
    if (/\s/.test(c)) { i += 1; continue; }
    if (c === '%') {
      if (t.startsWith('%{', i)) { const end = t.indexOf('%}', i); i = end < 0 ? t.length : end + 2; }
      else skipLine();
      continue;
    }
    if (c === '"') { skipString(); continue; }
    if (c === '#') {
      i += 1;
      if (t[i] === "'" && t[i + 1] === '(') { i += 1; skipBalanced('(', ')'); continue; }
      if (t[i] === '(') { skipBalanced('(', ')'); continue; }
      if (t[i] === '"') { skipString(); continue; }
      const m = /^[#a-zA-Z0-9.:'\\-]+/.exec(t.slice(i));
      if (m) i += m[0].length;
      continue;
    }
    if (c === '\\') {
      i += 1;
      const w = word();
      if (w === null) { i += 1; continue; }
      if (w === 'relative') { skipSpace(); const p = readPitch(); st.mode = 'relative'; st.prev = LETTERS[p.letter] + 7 * (3 + p.marks); continue; }
      if (w === 'key') {
        skipSpace();
        const p = readPitch();
        skipSpace();
        let mode = 'major';
        if (t[i] === '\\') { i += 1; mode = word() || 'major'; }
        st.key = { letter: p.letter, alter: p.alter, mode };
        continue;
      }
      if (w === 'time') {
        skipSpace();
        const m = /^(\d+)\/(\d+)/.exec(t.slice(i));
        if (m) { st.time = [Number(m[1]), Number(m[2])]; i += m[0].length; }
        continue;
      }
      if (w === 'clef') {
        skipSpace();
        if (t[i] === '"') { const s = i + 1; skipString(); st.clef = t.slice(s, i - 1); } else st.clef = word();
        continue;
      }
      if (w === 'markup') {
        skipSpace();
        if (t[i] === '{') { skipBalanced('{', '}'); continue; }
        if (t[i] === '"') { skipString(); continue; }
        if (t[i] === '\\') { i += 1; word(); continue; }
        word();
        continue;
      }
      if (w === 'repeat' || w === 'alternative') {
        skipSpace();
        if (t[i] === '"') skipString(); else word();
        skipSpace();
        const n = /^\d+/.exec(t.slice(i));
        if (n) i += n[0].length;
        continue;
      }
      if (w === 'partial') {
        refuse('a pickup bar');
        skipSpace();
        const d = /^\d+\.*/.exec(t.slice(i));
        if (d) i += d[0].length;
        continue;
      }
      if (w === 'ottava') {
        skipSpace();
        const m = /^#(-?\d+)/.exec(t.slice(i));
        if (m) { i += m[0].length; st.ottava = Number(m[1]) !== 0; } else st.ottava = true;
        if (st.ottava) refuse('an ottava bracket');
        continue;
      }
      if (w === 'rest') { if (cur.notes.length) cur.notes.pop(); continue; }
      if (LINE_CMD.has(w)) { skipLine(); continue; }
      if (REFUSE.has(w)) { refuse(`\\${w}`); continue; }
      if (HARMLESS.has(w)) continue;
      refuse(`\\${w}`);
      continue;
    }
    if (t.startsWith('<<', i)) { i += 2; poly += 1; refuse('polyphony'); continue; }
    if (t.startsWith('>>', i)) { i += 2; poly = Math.max(0, poly - 1); continue; }
    if (c === '<') {
      i += 1;
      const notes = [];
      while (i < t.length && t[i] !== '>') {
        if (/\s/.test(t[i])) { i += 1; continue; }
        if (/[a-g]/.test(t[i]) && looksLikePitch()) { notes.push(readPitch()); continue; }
        if (t[i] === '-' || t[i] === '^' || t[i] === '_') { i += 1; const m = /^\d+/.exec(t.slice(i)); if (m) i += m[0].length; continue; }
        if (t[i] === '\\') { i += 1; word(); continue; }
        i += 1;
      }
      i += 1;
      const d = /^(\d+)(\.*)/.exec(t.slice(i));
      let den = null;
      let dots = 0;
      if (d) { den = Number(d[1]); dots = d[2].length; i += d[0].length; }
      if (notes.length === 0) continue; // <> hangs a dynamic on nothing
      if (notes.length !== 1) { refuse('a chord'); continue; }
      const p = notes[0];
      const useDen = den || p.den || (lastDur && lastDur.den);
      const useDots = den ? dots : (p.den ? p.dots : (lastDur ? lastDur.dots : 0));
      addNote(p, useDen, useDots);
      continue;
    }
    if (c === '|') {
      i += 1;
      if (t[i] === '|') { i += 1; continue; }
      st.bars.push(cur);
      startBar();
      continue;
    }
    if (/[a-g]/.test(c) && looksLikePitch()) {
      const p = readPitch();
      addNote(p, p.den || (lastDur && lastDur.den), p.den ? p.dots : (lastDur ? lastDur.dots : 0));
      continue;
    }
    if ((c === 'r' || c === 'R' || c === 's') && !/[a-zA-Z]/.test(t[i + 1] || '')) {
      i += 1;
      const d = /^(\d+)(\.*)/.exec(t.slice(i));
      let den = null;
      let dots = 0;
      if (d) { den = Number(d[1]); dots = d[2].length; i += d[0].length; }
      const useDen = den || (lastDur && lastDur.den);
      const useDots = den ? dots : (lastDur ? lastDur.dots : 0);
      if (!useDen) { refuse('a rest with no duration'); continue; }
      lastDur = { den: useDen, dots: useDots };
      cur.ticks += durTicks(useDen, useDots);
      continue;
    }
    if ('[]()~{}*!?='.includes(c)) { i += 1; continue; }
    if (c === '-' || c === '^' || c === '_') {
      i += 1;
      const m = /^\d+/.exec(t.slice(i));
      if (m) { i += m[0].length; continue; }
      if ('.!>^_-+'.includes(t[i])) i += 1;
      continue;
    }
    refuse(`the token ${JSON.stringify(c)}`);
    i += 1;
  }
  if (cur.notes.length || cur.ticks > 0n) st.bars.push(cur);
  return st;
}

// ── notation ──────────────────────────────────────────────────────────────

/** How many sharps (positive) or flats (negative) the key signature draws. */
function keySignature(key) {
  if (!key) return { tonic: 'C', mode: 'major', fifths: 0 };
  const major = { c: 0, g: 1, d: 2, a: 3, e: 4, b: 5, f: -1 };
  const minor = { a: 0, e: 1, b: 2, f: -4, c: -3, g: -2, d: -1 };
  const table = key.mode === 'minor' ? minor : major;
  let fifths = table[key.letter];
  if (fifths === undefined) fifths = 0;
  fifths += key.alter * 7;
  return { tonic: NAMES[LETTERS[key.letter]] + accidental(key.alter), mode: key.mode, fifths };
}

function accidental(alter) {
  if (alter === 0) return '';
  return alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter);
}

/** The alteration the key signature already applies to a letter. */
function alterInKey(step, fifths) {
  const name = NAMES[step];
  const at = SHARP_ORDER.indexOf(name);
  if (fifths > 0) return at < fifths ? 1 : 0;
  if (fifths < 0) return SHARP_ORDER.length - 1 - at < -fifths ? -1 : 0;
  return 0;
}

/**
 * Which notes print an accidental. Standard practice: one per letter and octave
 * per bar, and a natural where a bar's earlier accidental is cancelled. The
 * generator settles it so that the drawing module never has to.
 */
function markAccidentals(notes, fifths) {
  const state = new Map();
  return notes.map((n) => {
    const key = `${n.step}:${n.octave}`;
    const standing = state.has(key) ? state.get(key) : alterInKey(n.step, fifths);
    const show = n.alter !== standing;
    if (show) state.set(key, n.alter);
    return { ...n, acc: show ? n.alter : null };
  });
}

// ── emit ──────────────────────────────────────────────────────────────────

function licenceFor(spdx, mutopiaLicence, maintainer, dirs) {
  const shareAlike = spdx.startsWith('CC-BY');
  return {
    source: `Mutopia Project engravings, typeset by ${maintainer}`,
    url: 'https://www.mutopiaproject.org/legal.html',
    spdx,
    derived: true,
    id: 'mutopia',
    acknowledgement: shareAlike
      ? `Scores engraved for the Mutopia Project by ${maintainer} and licensed ${mutopiaLicence}. `
        + 'Reused here under the same licence, which the notes below inherit.'
      : `Scores engraved for the Mutopia Project by ${maintainer} and placed in the public domain by the typesetter.`,
    links: ['https://www.mutopiaproject.org/', 'https://www.mutopiaproject.org/legal.html'].concat(
      dirs.map((d) => `https://www.mutopiaproject.org/ftp/${d}/`)),
    screen: shareAlike ? 'required' : 'none',
    mutopia_licence: mutopiaLicence,
    engraver: maintainer,
    generated_by: TOOL,
    generated_at: GENERATED_AT,
    note: 'The licence and the engraver were read from each piece\'s own .rdf by '
      + `${TOOL} and never copied by hand. One file, one licence, one engraver.`,
  };
}

function buildPiece(base, row) {
  const rdfPath = fetchFile(base, row.dir, `${row.stem}.rdf`);
  const rdf = parseRdf(fs.readFileSync(rdfPath, 'utf8'));
  const lyName = rdf.lyFile || `${row.stem}.ly`;
  const lyPath = fetchFile(base, row.dir, lyName);
  const lyText = fs.readFileSync(lyPath, 'utf8');

  const block = extractBlock(lyText, row.voice);
  const context = row.context ? extractBlock(lyText, row.context) : null;
  let st = null;
  let refused = {};
  let bars = [];
  let notes = 0;
  let seen = 0;
  if (block) {
    st = readVoice(`${context ? `${context} ` : ''}${block}`);
    seen = st.bars.length;
    const want = st.time ? (UNIT * BigInt(st.time[0])) / BigInt(st.time[1]) : null;
    const sig = keySignature(st.key);
    let n = 0;
    for (const bar of st.bars) {
      n += 1;
      let why = bar.refused;
      if (!why && want === null) why = 'no time signature';
      else if (!why && bar.ticks !== want) why = 'a bar that does not add up';
      else if (!why && !bar.notes.length) why = 'a bar of rests';
      if (why) { refused[why] = (refused[why] || 0) + 1; continue; }
      const id = `${row.id}-b${n}`;
      bars.push({
        id,
        n,
        notes: markAccidentals(bar.notes, sig.fifths).map((x, j) => ({
          id: `${id}-n${j + 1}`,
          name: NAMES[x.step] + accidental(x.alter),
          step: NAMES[x.step],
          alter: x.alter,
          octave: x.octave,
          d: x.idx,
          den: x.den,
          dots: x.dots,
          acc: x.acc,
        })),
      });
      notes += bar.notes.length;
    }
  }
  const sig = keySignature(st && st.key);
  return {
    piece: {
      id: row.id,
      title: row.title,
      composer: row.composer,
      composer_dates: row.composer_dates,
      rcm: row.rcm,
      rcm_note: row.rcm_note,
      readable: bars.length > 0,
      clef: (st && st.clef) || 'treble',
      key: sig.tonic,
      mode: sig.mode,
      fifths: sig.fifths,
      time: st && st.time ? st.time : null,
      voice: row.voice,
      read: { bars_seen: seen, bars_kept: bars.length, notes, refused },
      mutopia: {
        id: rdf.id || null,
        title: rdf.title || null,
        composer: rdf.composer || null,
        date: rdf.date || null,
        source: rdf.source || null,
        licence: rdf.licence || null,
        maintainer: rdf.maintainer || null,
        dir: row.dir,
        rdf: `${base}${row.dir}/${row.stem}.rdf`,
        ly: `${base}${row.dir}/${lyName}`,
        midi: rdf.midFile ? `${base}${row.dir}/${rdf.midFile}` : null,
        pdf: rdf.pdfFileA4 ? `${base}${row.dir}/${rdf.pdfFileA4}` : null,
        ly_bytes: fs.statSync(lyPath).size,
        ly_sha256: sha256(lyPath),
      },
      bars,
    },
    licence: rdf.licence || null,
    maintainer: rdf.maintainer || null,
  };
}

function main() {
  const sel = readSelection('piano.json');
  const base = sel.upstream.base;
  let problems = 0;
  const totals = { pieces: 0, readable: 0, bars: 0, notes: 0 };

  for (const file of sel.files) {
    const pieces = {};
    const order = [];
    const dirs = [];
    const licences = new Set();
    const maintainers = new Set();
    const counts = { pieces: 0, readable: 0, bars: 0, notes: 0 };

    for (const row of file.pieces) {
      const { piece, licence, maintainer } = buildPiece(base, row);
      licences.add(licence);
      maintainers.add(maintainer);
      dirs.push(row.dir);
      pieces[row.id] = piece;
      order.push(row.id);
      counts.pieces += 1;
      counts.bars += piece.bars.length;
      counts.notes += piece.read.notes;
      if (piece.readable) counts.readable += 1;
      const refused = Object.entries(piece.read.refused).map(([w, n]) => `${n} ${w}`).join(', ');
      process.stdout.write(
        `  ${row.id.padEnd(18)} ${String(piece.key + ' ' + piece.mode).padEnd(10)} `
        + `${piece.time ? piece.time.join('/') : '?'.padEnd(3)}  `
        + `${String(piece.read.bars_kept).padStart(3)}/${String(piece.read.bars_seen).padEnd(3)} bars  `
        + `${String(piece.read.notes).padStart(4)} notes  ${refused ? `refused ${refused}` : 'nothing refused'}\n`);
    }

    // C11.2 gives a file one _licence object, so it can name one licence and
    // one engraver. Two of either is a file that credits one of them and not
    // the other, which is the failure this stops rather than papers over.
    if (licences.size !== 1 || maintainers.size !== 1) {
      process.stderr.write(
        `REFUSED ${file.out}: ${licences.size} licence(s) and ${maintainers.size} maintainer(s) `
        + `(${[...licences].join(' | ')} / ${[...maintainers].join(' | ')}). `
        + 'Split the file per maintainer in tools/selection/piano.json rather than picking one.\n');
      problems += 1;
      continue;
    }
    const [mutopiaLicence] = [...licences];
    const [maintainer] = [...maintainers];
    const spdx = SPDX[mutopiaLicence];
    if (!spdx) {
      process.stderr.write(`REFUSED ${file.out}: the .rdf licence tag "${mutopiaLicence}" is not in this script's table.\n`);
      problems += 1;
      continue;
    }
    if (file.expect) {
      if (file.expect.licence !== mutopiaLicence || file.expect.maintainer !== maintainer) {
        process.stderr.write(
          `REFUSED ${file.out}: the selection expects "${file.expect.licence}" by "${file.expect.maintainer}", `
          + `the .rdf files say "${mutopiaLicence}" by "${maintainer}". Upstream moved.\n`);
        problems += 1;
        continue;
      }
    }

    const doc = {
      _licence: licenceFor(spdx, mutopiaLicence, maintainer, dirs),
      format: 'neo-piano-score/1',
      id: path.basename(file.out, '.json'),
      title: file.title,
      fields: {
        readable: 'false when the reader could follow no bar of the piece. The piece keeps its licence and its credits and drills nothing.',
        bars: 'the bars the reader could follow, numbered as written in the source.',
        'bars[].notes[].d': 'the diatonic index of the note, C4 being 28, so a staff position is one subtraction.',
        'bars[].notes[].acc': 'the accidental to print, or null. Settled here so that no drawing code has to.',
        'read.refused': 'what was dropped, and how often, per piece.',
      },
      counts,
      order,
      pieces,
    };
    const bytes = writeData(path.join(SITE, file.out), doc, BUDGET_KB);
    totals.pieces += counts.pieces;
    totals.readable += counts.readable;
    totals.bars += counts.bars;
    totals.notes += counts.notes;
    process.stdout.write(
      `  ${file.out}: ${counts.readable} of ${counts.pieces} readable, ${counts.bars} bars, `
      + `${counts.notes} notes, ${spdx}, engraved by ${maintainer}, ${fmtBytes(bytes)}\n\n`);
  }

  process.stdout.write(
    `piano: ${totals.readable} of ${totals.pieces} pieces readable, `
    + `${totals.bars} bars, ${totals.notes} drillable notes, ${sel.files.length} files\n`);
  if (problems) process.exitCode = 1;
}

const cli = process.argv[1] && process.argv[1].endsWith('build-piano.mjs');
if (cli) main();
