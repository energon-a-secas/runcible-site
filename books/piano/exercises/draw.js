// The two pictures this Book needs, drawn as SVG from data.
//
// The shell draws geometry from a declared data file and nothing else
// (js/render.js), and a figure on a page is not a prompt, so a drill whose
// question IS the picture has nowhere in the nine generic types to live. That
// is the sentence C2.1 asks for before a Book writes a module: `choice` can
// prompt with a field, and no field of any corpus is a note standing on a
// stave. Everything below is created with createElementNS, never parsed from a
// string, so a data file can never become markup.
//
// Positions come out of one number, the diatonic index `d`, which the corpus
// carries per note: the letter (C is 0 up to B is 6) plus seven times the
// octave, so middle C is 28. Every staff position in this file is that number
// minus the index of the clef's bottom line.

import { say, clefWord } from './strings.js';

const NS = 'http://www.w3.org/2000/svg';

/**
 * The diatonic index of the bottom line of each clef. The clef's own word is
 * not here: it is a string a learner reads, so it lives in ./strings.js with
 * the rest of them and reaches this file through the `t` each entry point
 * takes.
 */
export const CLEFS = {
  treble: { bottom: 30 },
  bass: { bottom: 18 },
};

/** Where each sharp and each flat is written, in the order they are written. */
const SIGNATURE = {
  treble: { sharp: [38, 35, 39, 36, 33, 37, 34], flat: [34, 37, 33, 36, 32, 35, 31] },
  bass: { sharp: [24, 21, 25, 22, 19, 23, 20], flat: [20, 23, 19, 22, 18, 21, 17] },
};

const GLYPH = { 1: '♯', '-1': '♭', 0: '♮', 2: '♯♯', '-2': '♭♭' };

const STEP = 6; // half the gap between two staff lines, so one position
const LINE_GAP = STEP * 2;
const TOP = 40; // y of the top staff line

function node(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
  if (text !== undefined) n.textContent = text;
  return n;
}

/**
 * The SVG root. It carries a viewBox and a style rather than width and height
 * attributes: the exercise host is a narrow rail on a wide screen and the whole
 * width of the page on a phone, and a bar of sixteen sixteenth notes is 640
 * units wide either way. Fixed attributes overflow the rail; the viewBox scales
 * to whatever it is given and the max-width stops a short bar from being blown
 * up to fill a wide one.
 */
function svgRoot(width, height, label) {
  return node('svg', {
    viewBox: `0 0 ${width} ${height}`,
    style: `width:100%;height:auto;max-width:${width}px;display:block`,
    class: 'pf-svg',
    role: 'img',
    'aria-label': label,
    fill: 'none',
    stroke: 'currentColor',
  });
}

/** y of a diatonic index on a given clef. */
function yOf(d, clef) {
  const bottom = (CLEFS[clef] || CLEFS.treble).bottom;
  return TOP + LINE_GAP * 4 - (d - bottom) * STEP;
}

function staffLines(svg, x0, x1) {
  for (let i = 0; i < 5; i += 1) {
    const y = TOP + i * LINE_GAP;
    svg.appendChild(node('line', { x1: x0, y1: y, x2: x1, y2: y, 'stroke-width': 1, opacity: 0.75 }));
  }
}

/**
 * The clef, as a word rather than as the musical glyph.
 *
 * U+1D11E and U+1D122 are absent from most system fonts, and a missing glyph
 * is a blank box where the whole question is. A word cannot be misread.
 */
function clefLabel(svg, clef, x, t) {
  const label = clefWord(t, clef);
  svg.appendChild(node('text', {
    x, y: TOP + LINE_GAP * 2 + 4, 'font-size': 11, fill: 'currentColor', stroke: 'none', opacity: 0.7,
  }, label));
}

function keySignature(svg, clef, fifths, x) {
  const table = SIGNATURE[clef] || SIGNATURE.treble;
  const many = fifths > 0 ? table.sharp.slice(0, fifths) : table.flat.slice(0, -fifths);
  const glyph = fifths > 0 ? GLYPH[1] : GLYPH['-1'];
  many.forEach((d, i) => {
    svg.appendChild(node('text', {
      x: x + i * 9, y: yOf(d, clef) + 5, 'font-size': 15, fill: 'currentColor', stroke: 'none',
    }, glyph));
  });
  return many.length * 9;
}

function ledgers(svg, d, clef, x) {
  const bottom = (CLEFS[clef] || CLEFS.treble).bottom;
  const lines = [];
  for (let k = bottom - 2; k >= d; k -= 2) lines.push(k);
  for (let k = bottom + 10; k <= d; k += 2) lines.push(k);
  for (const k of lines) {
    const y = yOf(k, clef);
    svg.appendChild(node('line', { x1: x - 11, y1: y, x2: x + 11, y2: y, 'stroke-width': 1, opacity: 0.75 }));
  }
}

/** One note head, with its stem, flags, dots and accidental. */
function noteHead(svg, note, clef, x, marked) {
  const y = yOf(note.d, clef);
  const den = note.den || 4;
  const hollow = den <= 2;
  ledgers(svg, note.d, clef, x);
  if (note.acc !== null && note.acc !== undefined) {
    svg.appendChild(node('text', {
      x: x - 20, y: y + 5, 'font-size': 15, fill: 'currentColor', stroke: 'none',
    }, GLYPH[String(note.acc)] || GLYPH['0']));
  }
  const head = node('ellipse', {
    cx: x, cy: y, rx: 6, ry: 4.5, 'stroke-width': 1.4,
    fill: hollow ? 'none' : 'currentColor',
  });
  if (marked) {
    svg.appendChild(node('circle', {
      cx: x, cy: y, r: 12, 'stroke-width': 2, 'stroke-dasharray': '3 3', opacity: 0.9,
    }));
  }
  svg.appendChild(head);
  if (den >= 2) {
    const up = note.d < (CLEFS[clef] || CLEFS.treble).bottom + 4;
    const sx = up ? x + 6 : x - 6;
    const sy = up ? y - 30 : y + 30;
    svg.appendChild(node('line', { x1: sx, y1: y, x2: sx, y2: sy, 'stroke-width': 1.2 }));
    const flags = den === 8 ? 1 : den === 16 ? 2 : den === 32 ? 3 : 0;
    for (let i = 0; i < flags; i += 1) {
      const fy = sy + (up ? i * 6 : -i * 6);
      svg.appendChild(node('line', {
        x1: sx, y1: fy, x2: sx + 7, y2: fy + (up ? 9 : -9), 'stroke-width': 1.2,
      }));
    }
  }
  for (let i = 0; i < (note.dots || 0); i += 1) {
    svg.appendChild(node('circle', { cx: x + 12 + i * 4, cy: y - 3, r: 1.6, fill: 'currentColor', stroke: 'none' }));
  }
}

/**
 * One bar of one staff, with the note at `markAt` circled.
 * `bar.notes` is what tools/build-piano.mjs read out of the engraving.
 */
export function drawBar(bar, { clef = 'treble', fifths = 0, time = null, markAt = 0, t = null }) {
  const notes = bar.notes || [];
  const left = 8;
  const width = Math.max(220, 96 + notes.length * 30);
  const svg = svgRoot(width, 130, say(t, 'ariaBar', {
    count: notes.length, clef: clefWord(t, clef, 'name'), at: markAt + 1,
  }));
  staffLines(svg, left, width - 8);
  clefLabel(svg, clef, left + 2, t);
  let x = left + 44;
  x += keySignature(svg, clef, fifths, x) + (fifths ? 8 : 0);
  if (time) {
    svg.appendChild(node('text', { x, y: TOP + LINE_GAP * 1.4, 'font-size': 13, fill: 'currentColor', stroke: 'none' }, String(time[0])));
    svg.appendChild(node('text', { x, y: TOP + LINE_GAP * 3.4, 'font-size': 13, fill: 'currentColor', stroke: 'none' }, String(time[1])));
    x += 16;
  }
  const gap = Math.max(22, (width - 16 - x) / Math.max(notes.length, 1));
  notes.forEach((n, i) => { noteHead(svg, n, clef, x + gap * i + gap / 2, i === markAt); });
  svg.appendChild(node('line', {
    x1: width - 8, y1: TOP, x2: width - 8, y2: TOP + LINE_GAP * 4, 'stroke-width': 1.4,
  }));
  return svg;
}

/** One note alone on one staff, which is all chapter 2 needs. */
export function drawNote(note, clef, t) {
  const svg = svgRoot(200, 130, say(t, 'ariaNote', { clef: clefWord(t, clef, 'name') }));
  staffLines(svg, 8, 192);
  clefLabel(svg, clef, 10, t);
  noteHead(svg, { d: note.d, den: 4, acc: null, dots: 0 }, clef, 120, true);
  return svg;
}

/**
 * One octave of a keyboard, with the key of pitch class `pc` marked.
 * White key widths and the black key offsets are the instrument's own
 * geometry: three black keys sit over four white gaps and two over three.
 */
export function drawKeyboard(pc, t) {
  const W = 34;
  const H = 132;
  const BW = 21;
  const BH = 82;
  const whites = [0, 2, 4, 5, 7, 9, 11];
  const blacks = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5]];
  const svg = svgRoot(W * 7 + 4, H + 12, say(t, 'ariaKeyboard'));
  whites.forEach((p, i) => {
    svg.appendChild(node('rect', {
      x: 2 + i * W, y: 6, width: W, height: H, rx: 3, 'stroke-width': 1.2,
      fill: p === pc ? 'currentColor' : 'none',
      'fill-opacity': p === pc ? 0.28 : 0,
    }));
  });
  for (const [p, leftWhite] of blacks) {
    svg.appendChild(node('rect', {
      x: 2 + (leftWhite + 1) * W - BW / 2, y: 6, width: BW, height: BH, rx: 2, 'stroke-width': 1.2,
      fill: 'currentColor',
      'fill-opacity': p === pc ? 0.85 : 0.55,
    }));
    if (p === pc) {
      svg.appendChild(node('rect', {
        x: 2 + (leftWhite + 1) * W - BW / 2 - 3, y: 3, width: BW + 6, height: BH + 6, rx: 4,
        'stroke-width': 2, 'stroke-dasharray': '3 3',
      }));
    }
  }
  return svg;
}
