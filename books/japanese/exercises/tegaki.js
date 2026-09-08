// jp.tegaki: write it by hand, and be told what the strokes did.
//
// The one custom module in this Book, and the sentence the skill asks for is
// short: none of the nine generic types can accept a pointer path as an answer.
// order comes closest, by shuffling pictures of strokes, which is a drill about
// the pictures.
//
// It grades four numbers against the KanjiVG paths the Book already declares:
// stroke count, order (drawn strokes matched one to one to the reference paths,
// so a swapped pair reads as a swap), direction (the sign of the start-to-end
// vector) and position (start to start, end to end). Shape fidelity is not
// among them, so bad handwriting in the taught order passes. The count is the
// taught hand's: a き whose last two strokes are joined is three here, not four.
//
// The reference geometry comes from getTotalLength and getPointAtLength on the
// paths already on the screen, because a KanjiVG d string is an absolute M plus
// relative curves and its last pair of numbers is an offset, not an endpoint.
// Where those two are missing the module says it cannot judge a trace and
// records nothing, the shape C2.5 gives a missing voice.
//
// Handwriting is a pointer act and this exercise has no keyboard path: the board
// carries an aria-label and every verdict lands in the frame's live region, but
// a learner who cannot use a pointer cannot do what the chapter is about. That
// is the subject, not an oversight, and the chapter is opt-in already.

import { el, add, clear, button, listeners, frame, pick } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';

/** KanjiVG's own box. Every trace is read in this space, never in pixels. */
const BOX = 109;

/** How far a start or an end may sit from the reference, in the 109 box. A
 *  finger lands wider than a mouse, and a threshold tuned on a trackpad fails
 *  on a phone, so a coarse pointer is given more room. */
const TOL = { fine: 26, coarse: 34 };

/** Under this the start-to-end vector is a dot, and a dot has no direction. */
const DOT = 6;
/** A move shorter than this adds nothing and is dropped. */
const STEP = 0.6;
/** Reasons shown at once, because a wall of them helps nobody. */
const MAX_REASONS = 2;
/** How a stroke is drawn, reference and ink alike, so the two cannot diverge. */
const STROKE = { fill: 'none', 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

// Every string a learner reads is here, in both languages, through api.t. A
// module that builds a sentence in code is a module that ships one language.
const T = {
  title: { en: 'Write it by hand', es: 'Escríbelo a mano' },
  lead: { en: 'Trace the character in the box, in the order you would write it. Nothing is judged until you press Check.',
    es: 'Traza el carácter en el recuadro, en el orden en que lo escribirías. Nada se juzga hasta que pulses Revisar.' },
  board: { en: 'Practice box for {glyph}', es: 'Recuadro de práctica para {glyph}' },
  progress: { en: '{i} of {n}', es: '{i} de {n}' },
  check: { en: 'Check', es: 'Revisar' },
  undo: { en: 'Undo', es: 'Deshacer' },
  wipe: { en: 'Clear', es: 'Borrar' },
  hint: { en: 'Show the order', es: 'Ver el orden' },
  next: { en: 'Next', es: 'Siguiente' },
  finish: { en: 'See the result', es: 'Ver el resultado' },
  go: { en: 'Continue', es: 'Continuar' },
  none: { en: 'Nothing was graded here.', es: 'Aquí no se calificó nada.' },
  empty: { en: 'Draw at least one stroke before checking.', es: 'Dibuja al menos un trazo antes de revisar.' },
  hintNote: { en: 'The numbers are the order. Reading them is fine, and it is recorded with the attempt.',
    es: 'Los números son el orden. Leerlos está bien, y queda registrado con el intento.' },
  right: { en: 'Correct order.', es: 'Orden correcto.' },
  wrong: { en: 'Not the taught order.', es: 'No es el orden enseñado.' },
  count: { en: 'You drew {drew}. In the taught hand, {glyph} has {want}.', es: 'Dibujaste {drew}. En la mano que se enseña, {glyph} tiene {want}.' },
  direction: { en: '{stroke} went {was}. It goes {want}.', es: '{stroke} fue {was}. Va {want}.' },
  order: { en: '{stroke} is where stroke {n} goes.', es: '{stroke} está donde va el trazo {n}.' },
  offStart: { en: '{stroke} started too far from where that stroke begins.',
    es: '{stroke} empezó demasiado lejos de donde ese trazo comienza.' },
  offEnd: { en: '{stroke} ended too far from where that stroke finishes.',
    es: '{stroke} terminó demasiado lejos de donde ese trazo termina.' },
  score: { en: '{right} of {asked} in the taught order.', es: '{right} de {asked} en el orden enseñado.' },
  noGeometry: { en: 'This browser cannot measure a path, so a trace cannot be judged here and nothing is recorded. The stroke order is still shown.',
    es: 'Este navegador no puede medir una ruta, así que aquí no se puede juzgar un trazo y no se registra nada. El orden de trazos se sigue mostrando.' },
  strokeOne: { en: 'stroke', es: 'trazo' },
  strokeMany: { en: 'strokes', es: 'trazos' },
  yourNth: { en: 'your {ord} stroke', es: 'tu {ord} trazo' },
  yourN: { en: 'your stroke {n}', es: 'tu trazo {n}' },
};

const ORDINAL = {
  en: ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'],
  es: ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'],
};

const DIR = {
  ltr: { en: 'left to right', es: 'de izquierda a derecha' },
  rtl: { en: 'right to left', es: 'de derecha a izquierda' },
  ttb: { en: 'top to bottom', es: 'de arriba abajo' },
  btt: { en: 'bottom to top', es: 'de abajo arriba' },
};

/** Resolve one {en, es} entry and fill its {placeholders}. */
function say(api, entry, vars) {
  return String(api.t(entry) || '').replace(/\{(\w+)\}/g, (whole, key) => (
    vars && vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : whole));
}

/** "4 strokes", "1 trazo". */
function counted(api, n) {
  return `${n} ${api.t(n === 1 ? T.strokeOne : T.strokeMany)}`;
}

/** "your third stroke", "tu trazo 14". */
function whichStroke(api, i) {
  const words = ORDINAL[api.lang] || ORDINAL.en;
  return words[i] ? say(api, T.yourNth, { ord: words[i] }) : say(api, T.yourN, { n: i + 1 });
}

/** Capital on the first letter, because a phrase can open a sentence. */
function sentence(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function svgEl(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [key, v] of Object.entries(attrs || {})) {
    if (v !== null && v !== undefined) node.setAttribute(key, String(v));
  }
  return node;
}

const vec = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
const mag = (v) => Math.sqrt((v.x * v.x) + (v.y * v.y));
const dot = (a, b) => (a.x * b.x) + (a.y * b.y);
const gap = (a, b) => mag(vec(a, b));

/** Which way a stroke travels, named by its longer axis. */
function headingOf(v) {
  if (Math.abs(v.x) >= Math.abs(v.y)) return v.x >= 0 ? 'ltr' : 'rtl';
  return v.y >= 0 ? 'ttb' : 'btt';
}

/** The start and the end of a drawn stroke. */
const endsOf = (points) => ({ start: points[0], end: points[points.length - 1] });

/** Start and end of every reference path, read from the elements on the page.
 *  Null where the browser has no path measurement, the one condition this
 *  module cannot work around. */
function referenceOf(paths) {
  if (!paths.length || typeof paths[0].getTotalLength !== 'function') return null;
  try {
    return paths.map((path) => {
      const a = path.getPointAtLength(0);
      const b = path.getPointAtLength(path.getTotalLength());
      return { start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y } };
    });
  } catch (err) {
    console.warn('[runcible] jp.tegaki could not measure the reference paths', err);
    return null;
  }
}

/** Which reference stroke each drawn one belongs to, one to one: pairs ranked by
 *  start-to-start plus end-to-end distance, closest claiming each other first,
 *  so no reference answers twice. Two adjacent parallel strokes in the wrong
 *  order then read as a swap, which a per-stroke nearest match cannot see, since
 *  each is inside the other's tolerance; an untidy stroke keeps its own, its
 *  neighbour having claimed the neighbour first. */
function assign(ends, ref) {
  const pairs = [];
  ends.forEach((m, i) => ref.forEach((r, j) => pairs.push([gap(m.start, r.start) + gap(m.end, r.end), i, j])));
  const to = new Array(ends.length).fill(-1);
  for (const [, i, j] of pairs.sort((a, b) => a[0] - b[0])) if (to[i] < 0 && !to.includes(j)) to[i] = j;
  return to;
}

/** The four numbers, count first: a character with the wrong number of strokes
 *  has no nth stroke to compare. Returns { ok, misses[] }. */
function judge(strokes, ref, tol) {
  if (strokes.length !== ref.length) {
    return { ok: false, misses: [{ kind: 'count', drew: strokes.length, want: ref.length }] };
  }
  const ends = strokes.map(endsOf);
  const to = assign(ends, ref);
  const misses = [];
  for (let i = 0; i < ref.length; i++) {
    const mine = ends[i];
    const want = ref[i];
    const wantVec = vec(want.start, want.end);
    const myVec = vec(mine.start, mine.end);
    if (mag(wantVec) >= DOT && mag(myVec) >= DOT && dot(wantVec, myVec) < 0) {
      misses.push({ kind: 'direction', i, was: headingOf(myVec), want: headingOf(wantVec) });
      continue;
    }
    if (to[i] >= 0 && to[i] !== i) { misses.push({ kind: 'order', i, j: to[i] }); continue; }
    const fromStart = gap(mine.start, want.start);
    const fromEnd = gap(mine.end, want.end);
    if (fromStart > tol || fromEnd > tol) misses.push({ kind: fromStart > fromEnd ? 'offStart' : 'offEnd', i });
  }
  return { ok: misses.length === 0, misses };
}

/** One miss, as a sentence. */
function reasonFor(api, miss, glyph) {
  if (miss.kind === 'count') {
    return say(api, T.count, { drew: counted(api, miss.drew), glyph, want: counted(api, miss.want) });
  }
  const stroke = whichStroke(api, miss.i);
  if (miss.kind === 'direction') {
    return sentence(say(api, T.direction, { stroke, was: api.t(DIR[miss.was]), want: api.t(DIR[miss.want]) }));
  }
  if (miss.kind === 'order') return sentence(say(api, T.order, { stroke, n: miss.j + 1 }));
  return sentence(say(api, T[miss.kind], { stroke }));
}

/** A compact English log line for the attempt record, never shown on screen. */
function logLine(strokes, verdict) {
  const kinds = verdict.misses.map((m) => (m.kind === 'count' ? 'count' : `${m.kind}@${m.i + 1}`));
  return `strokes=${strokes.length}${kinds.length ? ` ${kinds.join(' ')}` : ' ok'}`;
}

/**
 * Every character this run can ask for. A strokes file is a map keyed by glyph
 * with `_licence` and `viewBox` at the same level, so the glyphs come from the
 * file's own `order` array rather than from its keys. `only` narrows the set,
 * as a string of glyphs or an array of them, and a repeat is dropped by
 * literal: that is what lets the kanji rung stack grade one over the number
 * and day files without asking twice for what they share.
 */
async function charactersFor(api, props) {
  const sources = Array.isArray(props.sources) ? props.sources
    : (typeof props.sources === 'string' && props.sources ? [props.sources] : []);
  const wanted = typeof props.only === 'string' ? Array.from(props.only)
    : (Array.isArray(props.only) ? props.only : null);
  const keep = wanted ? new Set(wanted) : null;
  const seen = new Set();
  const out = [];
  for (const src of sources) {
    const doc = await api.data(src);
    if (!doc || typeof doc !== 'object') continue;
    const order = Array.isArray(doc.order) ? doc.order : [];
    for (const glyph of order) {
      if (seen.has(glyph)) continue;
      if (keep && !keep.has(glyph)) continue;
      const rec = doc[glyph];
      if (!rec || !Array.isArray(rec.s) || !rec.s.length) continue;
      seen.add(glyph);
      out.push({ glyph, paths: rec.s, at: Array.isArray(rec.at) ? rec.at : [] });
    }
  }
  return out;
}

/**
 * The practice square: two faint guide lines, the reference strokes to trace,
 * and an empty layer the drawn strokes land in. The style attribute carries
 * only what has no home in the site's stylesheet and no meaning away from this
 * element: touch-action, which stops a finger scrolling instead of drawing,
 * and the box's own size and ground.
 */
function makeBoard(api, entry) {
  const svg = svgEl('svg', {
    viewBox: `0 0 ${BOX} ${BOX}`,
    width: 300,
    height: 300,
    class: 'jp-tegaki-board',
    role: 'img',
    'aria-label': say(api, T.board, { glyph: entry.glyph }),
    style: 'touch-action:none; width:min(300px,100%); height:auto; '
      + 'border:1px solid var(--border); border-radius:var(--radius); background:var(--surface-1)',
  });
  const half = BOX / 2;
  for (const [x1, y1, x2, y2] of [[half, 0, half, BOX], [0, half, BOX, half]]) {
    svg.appendChild(svgEl('line', {
      x1, y1, x2, y2, stroke: 'currentColor', 'stroke-opacity': 0.14, 'stroke-width': 0.7, 'stroke-dasharray': '4 4',
    }));
  }
  const refs = entry.paths.map((d) => svgEl('path', Object.assign({ d }, STROKE, {
    stroke: 'currentColor', 'stroke-opacity': 0.2,
  })));
  const refLayer = svgEl('g', { class: 'jp-tegaki-ref' });
  for (const p of refs) refLayer.appendChild(p);
  const inkLayer = svgEl('g', { class: 'jp-tegaki-ink' });
  const markLayer = svgEl('g', { class: 'jp-tegaki-marks' });
  svg.append(refLayer, inkLayer, markLayer);
  return { svg, refs, inkLayer, markLayer };
}

/** The numbered starts, drawn from KanjiVG's own label positions. */
function drawOrder(board, entry) {
  clear(board.markLayer);
  for (let i = 0; i < entry.paths.length; i++) {
    const spot = entry.at[i];
    const x = spot ? spot[0] : 6;
    const y = spot ? spot[1] : 6 + (i * 8);
    const label = svgEl('text', { x, y: y + 2.6, 'text-anchor': 'middle', 'font-size': 7, fill: 'var(--text-primary)' });
    label.textContent = String(i + 1);
    board.markLayer.appendChild(svgEl('circle', {
      cx: x, cy: y, r: 5.4, fill: 'var(--surface-2)', stroke: 'var(--accent)', 'stroke-width': 0.8,
    }));
    board.markLayer.appendChild(label);
  }
}

/** A drawn stroke as a d string. Two decimals is finer than any pointer. */
function pathD(points) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

/** The element carrying the ink of one stroke. */
function inkPath(points) {
  return svgEl('path', Object.assign({ d: pathD(points) }, STROKE, { stroke: 'var(--accent-bright)' }));
}

export default function register(runcible) {
  runcible.registerExercise('jp.tegaki', {
    mount(host, spec, api) {
      const bound = listeners();
      let alive = true;
      const props = spec.props || {};
      const view = frame(host, { title: api.t(spec.title) || api.t(T.title), lead: api.t(T.lead), cls: 'jp--tegaki' });

      let queue = [];
      let at = 0;
      let asked = 0;
      let right = 0;
      let coarse = false;
      // Per character, reset by show(): the board, its reference geometry, the
      // finished strokes, the one being drawn, and how this one was answered.
      let board = null;
      let ref = null;
      let strokes = [];
      let live = null;
      let livePath = null;
      let checked = false;
      let hinted = false;
      let shownAt = 0;
      const tol = () => (coarse ? TOL.coarse : TOL.fine);

      function pointAt(e) {
        const r = board.svg.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return { x: ((e.clientX - r.left) / r.width) * BOX, y: ((e.clientY - r.top) / r.height) * BOX };
      }

      function extend(e) {
        if (!live) return;
        const raw = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        let grew = false;
        for (const m of raw.length ? raw : [e]) {
          const p = pointAt(m);
          if (!p || gap(live[live.length - 1], p) < STEP) continue;
          live.push(p);
          grew = true;
        }
        if (grew) livePath.setAttribute('d', pathD(live));
      }

      function endStroke() {
        if (!live) return;
        strokes.push(live);
        live = null;
        livePath = null;
      }

      function wipe() {
        endStroke();
        strokes = [];
        if (board) clear(board.inkLayer);
      }

      function undo() {
        endStroke();
        strokes.pop();
        if (board && board.inkLayer.lastChild) board.inkLayer.removeChild(board.inkLayer.lastChild);
      }

      /** Move to the next character, or to the score when there is none left. */
      function onward(label) {
        clear(view.foot);
        const go = button(api.t(label), () => { at += 1; show(); }, 'btn btn--primary');
        view.foot.appendChild(go);
        go.focus();
      }

      function check(entry) {
        if (checked) return;
        // Close whatever is still under the pointer first: a learner who
        // presses Check without lifting has still drawn that stroke.
        endStroke();
        if (!strokes.length) { view.status.textContent = api.t(T.empty); return; }
        checked = true;
        const verdict = judge(strokes, ref, tol());
        asked += 1;
        if (verdict.ok) right += 1;
        api.attempt({
          itemId: `tegaki:${entry.glyph}`,
          skill: spec.skill,
          correct: verdict.ok,
          ms: Math.round(performance.now() - shownAt),
          answer: logLine(strokes, verdict),
          expected: `strokes=${entry.paths.length} ok`,
          hintUsed: hinted,
        });
        view.status.textContent = api.t(verdict.ok ? T.right : T.wrong);
        drawOrder(board, entry);
        for (const m of verdict.misses) {
          const path = Number.isInteger(m.i) ? board.refs[m.i] : null;
          if (path) { path.setAttribute('stroke', 'var(--accent)'); path.setAttribute('stroke-opacity', '0.75'); }
        }
        add(view.body, verdict.misses.slice(0, MAX_REASONS)
          .map((m) => el('p', { class: 'jp-note rx-verdict', text: reasonFor(api, m, entry.glyph) })));
        onward(at >= queue.length - 1 ? T.finish : T.next);
      }

      function show() {
        if (!alive) return;
        if (at >= queue.length) return end();
        const entry = queue[at];
        strokes = [];
        live = null;
        livePath = null;
        checked = false;
        hinted = false;
        shownAt = performance.now();
        clear(view.body);
        clear(view.foot);
        board = makeBoard(api, entry);
        ref = referenceOf(board.refs);
        view.status.textContent = say(api, T.progress, { i: at + 1, n: queue.length });
        add(view.body, board.svg);
        if (!ref) {
          drawOrder(board, entry);
          add(view.body, el('p', { class: 'jp-note', text: api.t(T.noGeometry) }));
          onward(at >= queue.length - 1 ? T.finish : T.next);
          return;
        }

        bound.on(board.svg, 'pointerdown', (e) => {
          if (checked || e.button > 0) return;
          coarse = e.pointerType === 'touch';
          const p = pointAt(e);
          if (!p) return;
          e.preventDefault();
          if (typeof board.svg.setPointerCapture === 'function') board.svg.setPointerCapture(e.pointerId);
          live = [p];
          livePath = inkPath(live);
          board.inkLayer.appendChild(livePath);
        });
        bound.on(board.svg, 'pointermove', (e) => { if (live) { e.preventDefault(); extend(e); } });
        // The capture keeps up and cancel on the board even when the finger
        // leaves it; the window pair closes the stroke where capture was
        // refused, rather than leaving it open for the next one.
        for (const type of ['pointerup', 'pointercancel']) {
          bound.on(board.svg, type, () => endStroke());
          bound.on(window, type, () => endStroke());
        }

        add(view.foot, [
          button(api.t(T.undo), () => undo(), 'btn btn--ghost btn--sm'),
          button(api.t(T.wipe), () => wipe(), 'btn btn--ghost btn--sm'),
          button(api.t(T.hint), () => {
            hinted = true;
            drawOrder(board, entry);
            view.status.textContent = api.t(T.hintNote);
          }, 'btn btn--ghost btn--sm'),
          button(api.t(T.check), () => check(entry), 'btn btn--primary'),
        ]);
      }

      /** The score, and the one button that hands the rung back to the shell. */
      function end() {
        clear(view.body);
        clear(view.foot);
        view.status.textContent = '';
        add(view.body, el('p', {
          class: 'jp-score',
          text: asked ? say(api, T.score, { right, asked }) : api.t(T.none),
        }));
        const go = button(api.t(T.go), () => api.done({ asked, right, graded: true }), 'btn btn--primary');
        view.foot.appendChild(go);
        go.focus();
      }

      charactersFor(api, props).then((list) => {
        if (!alive) return;
        if (!list.length) return end();
        queue = pick(list, props.count);
        at = 0;
        return show();
      }).catch((err) => {
        if (!alive) return;
        view.status.textContent = err.message;
        console.error('[runcible] jp.tegaki could not load its characters', err);
      });

      return {
        destroy() {
          alive = false;
          bound.off();
          clear(host);
        },
      };
    },
  });
}
