/**
 * The LilyPond reader: one named staff of a `.ly` source, turned into bars.
 *
 * Split out of tools/build-piano.mjs, which is the entry point and the only
 * thing that runs. This half is a state machine over text and nothing else: it
 * touches no file, fetches nothing and prints nothing, so it can be read, and
 * reasoned about, without the fetching and the emitting around it.
 *
 * The reader is deliberately narrow. Everything it does not recognise refuses
 * the bar it is in, which is why the unknown-token branch at the bottom of
 * readVoice is not a fallback but the whole safety property: a bar this file
 * misread almost never adds up to its time signature, and the caller drops it.
 */
import { LETTERS } from './piano-notation.mjs';

/** One whole note, in ticks. Every duration divides it exactly. */
export const UNIT = 1024n;

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
