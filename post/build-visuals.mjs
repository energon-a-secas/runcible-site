/**
 * Diagrams for "Six complaints about how it looked".
 *
 * Every number in these three figures is read out of the three repositories,
 * not typed here. The exercise counts come from parsing the Book's chapter
 * files; the breakpoints come from the stylesheet and the module constant that
 * has to agree with it; the embed URL is built by calling Runcible's own
 * quizUrl(), which takes an `env` argument precisely so a node process with no
 * DOM can call it; the message vocabulary is scraped out of the two files that
 * send and receive it; and the byte-identical claim is a sha256 of both copies
 * of all 25 sets, computed at build time. Change any of it and the picture
 * moves, or this script throws.
 *
 * It reads three sibling repositories under projects/. That is not a new
 * coupling: tools/build-sets.mjs already writes into ../quiz-site by way of
 * tools/selection/sets.json, and this file resolves the same target the same
 * way rather than hardcoding a second copy of the path. Outside the monorepo
 * the sibling repositories are absent and every read here fails loudly.
 *
 *   node projects/runcible-site/post/build-visuals.mjs
 *   node projects/runcible-site/post/rasterize.mjs
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  frame, heading, footnote, legend, emit, esc,
  BG, INK, DIM, MUTE, LINE, ACCENT, FONT, KANJI,
} from './diagram-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNCIBLE = join(HERE, '..');

/* ── The other two sites ──────────────────────────────────────────────
   Resolved through Runcible's own selection file, so the path lives in one
   place. RAPPEL is not named there (nothing generates into it) and is the
   sibling directory by convention; it is only read for a count. */
const SELECTION = JSON.parse(readFileSync(join(RUNCIBLE, 'tools/selection/sets.json'), 'utf8'));
const QUIZ = resolve(RUNCIBLE, SELECTION.targets.quiz_site);
const RAPPEL = resolve(RUNCIBLE, '../rappel-site');
const BOOK = SELECTION.targets.runcible_book;

for (const [name, dir] of [['quiz-site', QUIZ], ['rappel-site', RAPPEL]]) {
  if (!existsSync(dir)) {
    throw new Error(`${name} is not at ${dir}. These diagrams read all three repositories; clone the fleet or run this from the monorepo.`);
  }
}

/* Each site's own --accent, read from its stylesheet rather than copied, so a
   rebrand of any of the three moves the diagrams with it. */
function accentOf(dir) {
  const css = readFileSync(join(dir, 'css/style.css'), 'utf8');
  const m = /--accent:\s*(#[0-9a-fA-F]{3,8})/.exec(css);
  if (!m) throw new Error(`no --accent in ${dir}/css/style.css`);
  return m[1];
}
const C_RUNCIBLE = accentOf(RUNCIBLE);
const C_QUIZ = accentOf(QUIZ);
const C_RAPPEL = accentOf(RAPPEL);
if (C_RUNCIBLE.toLowerCase() !== ACCENT.toLowerCase()) {
  throw new Error(`diagram-kit ACCENT is ${ACCENT} and Runcible's --accent is ${C_RUNCIBLE}: change the kit`);
}

/* ── The model, imported ──────────────────────────────────────────────
   js/quiz-host.js reaches document at import time through its own imports.
   The shim is the smallest thing that lets the module load; quizUrl() and
   readAnswer() are pure and take everything they need as arguments. */
globalThis.window = globalThis;
globalThis.document = {
  baseURI: 'https://runcible.neorgon.com/',
  documentElement: { dataset: {} },
  addEventListener() {}, removeEventListener() {},
  querySelector() { return null; }, getElementById() { return null; },
  createElement() { return { style: {}, dataset: {}, setAttribute() {}, appendChild() {}, classList: { add() {} } }; },
};
globalThis.location = {
  hostname: 'runcible.neorgon.com', protocol: 'https:',
  origin: 'https://runcible.neorgon.com', pathname: '/', search: '',
};
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const host = await import('../js/quiz-host.js');
const spec = await import('../js/exercises/spec.js');
const engine = await import(`${QUIZ}/js/embed.js`);

if (host.PROTOCOL_VERSION !== engine.PROTOCOL_VERSION) {
  throw new Error(`host speaks v${host.PROTOCOL_VERSION} and the engine speaks v${engine.PROTOCOL_VERSION}`);
}
const CONTRACT = engine.CONTRACT;
const V = engine.PROTOCOL_VERSION;

/* ── The model, parsed ────────────────────────────────────────────────── */

const j = (p) => JSON.parse(readFileSync(p, 'utf8'));
const src = (p) => readFileSync(p, 'utf8');

/** Every exercise in the Japanese Book, by type, with the quiz ones detailed. */
function exercises() {
  const dir = join(RUNCIBLE, 'books', BOOK, 'chapters');
  const byType = new Map();
  const quiz = [];
  let chapters = 0; let rungs = 0; let pages = 0; let total = 0;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const ch = j(join(dir, f));
    chapters += 1;
    for (const rung of ch.rungs || []) {
      rungs += 1;
      pages += (rung.pages || []).length;
      for (const ex of rung.exercises || []) {
        total += 1;
        byType.set(ex.type, (byType.get(ex.type) || 0) + 1);
        if (ex.type === 'quiz') quiz.push({ ...ex, chapter: ch.id });
      }
    }
  }
  return { chapters, rungs, pages, total, byType, quiz };
}

/** How the 56 rounds narrow themselves, counted by the field the filter names. */
function filters(quiz) {
  const byField = new Map();
  let unfiltered = 0;
  for (const ex of quiz) {
    if (!ex.filter) { unfiltered += 1; continue; }
    const { field, problem } = spec.parseQuizFilter(ex.filter);
    if (problem) throw new Error(`${ex.id}: the Book's own filter does not parse: ${problem}`);
    byField.set(field, (byField.get(field) || 0) + 1);
  }
  return { byField, unfiltered, filtered: quiz.length - unfiltered };
}

/** Both copies of every set, hashed. The claim the pipeline diagram makes. */
function sets() {
  const bookDir = join(RUNCIBLE, 'books', BOOK, 'sets');
  const quizDir = join(QUIZ, 'data/sets');
  const rows = [];
  const games = new Map();
  let items = 0;
  for (const name of readdirSync(bookDir).filter((n) => n.endsWith('.json')).sort()) {
    const a = readFileSync(join(bookDir, name));
    const bPath = join(quizDir, name);
    if (!existsSync(bPath)) throw new Error(`${name} is in the Book and not in Quiz's library`);
    const b = readFileSync(bPath);
    const doc = JSON.parse(a);
    const same = createHash('sha256').update(a).digest('hex') === createHash('sha256').update(b).digest('hex');
    rows.push({
      id: doc.id, game: doc.game, n: doc.items.length, same, bytes: a.length,
      /* A set the honesty line falls back on: the songs, whose corpus gives no
         English title to translate from either. */
      noSpanishName: !doc.name || !doc.name.es,
    });
    games.set(doc.game, (games.get(doc.game) || 0) + 1);
    items += doc.items.length;
  }
  const index = j(join(quizDir, 'index.json'));
  return { rows, games, items, identical: rows.filter((r) => r.same).length, indexFormat: index.format };
}

/** The corpus slices tools/build-sets.mjs reads, named by the selection file. */
function corpus() {
  const kinds = new Map();
  for (const s of SELECTION.sets) kinds.set(s.kind, (kinds.get(s.kind) || 0) + 1);
  const lw = j(join(RUNCIBLE, 'data/loanwords/seed.json'));
  const rules = j(join(RUNCIBLE, 'data/loanwords/rules.json'));
  const songs = j(join(RUNCIBLE, 'data/songs/index.json'));
  const vocab = j(join(RUNCIBLE, 'data/vocab/ch4.json'));
  /* One glyph record per kana, wherever the table files them: the gojuon rows,
     the dakuten rows, the yoon list and katakana's extended digraphs. More than
     the sets carry, because the contract leaves some out; data/README.md in
     quiz-site names every one it could not derive. */
  const kanaCount = (t) => ['rows', 'dakuten', 'yoon', 'extended'].reduce((n, key) => {
    const v = t[key];
    if (Array.isArray(v)) return n + v.length;
    if (v && typeof v === 'object') return n + Object.values(v).reduce((m, row) => m + (Array.isArray(row) ? row.length : 0), 0);
    return n;
  }, 0);
  const kana = kanaCount(j(join(RUNCIBLE, 'data/kana/hiragana.json')))
    + kanaCount(j(join(RUNCIBLE, 'data/kana/katakana.json')));
  const vocabWords = Object.values(vocab.groups).reduce((n, g) => n + (Array.isArray(g) ? g.length : 0), 0);
  if (vocabWords !== vocab.count) throw new Error(`data/vocab/ch4.json says ${vocab.count} words and holds ${vocabWords}`);
  return {
    kinds,
    loanwords: lw.entries.length,
    splits: lw.entries.filter((e) => Array.isArray(e.split) && e.split.length).length,
    rules: rules.rules.length,
    explained: rules.rules.filter((r) => r.explain && r.explain.en).length,
    kana,
    songs: songs.songs.length,
    vocab: vocabWords,
    vocabGroups: Object.keys(vocab.groups).length,
  };
}

/** The two numbers that have to be the same number. */
function breakpoints() {
  const css = src(join(RUNCIBLE, 'css/style.css'));
  const mount = src(join(RUNCIBLE, 'js/render-mount.js'));
  const facing = /const FACING = '\(min-width: (\d+)px\)'/.exec(mount);
  if (!facing) throw new Error('no FACING constant in js/render-mount.js');
  const grid = (needle) => {
    const at = css.indexOf(needle);
    if (at < 0) throw new Error(`no "${needle}" in css/style.css`);
    const m = /grid-template-columns:\s*([^;]+);/.exec(css.slice(at));
    return m[1].replace(/\s+/g, ' ').trim();
  };
  const token = (name) => {
    const m = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
    if (!m) throw new Error(`no ${name} token in css/style.css`);
    return m[1].split('/')[0].trim();
  };
  const spreads = [...css.matchAll(/@media \(min-width: (\d+)px\)/g)].map((m) => Number(m[1]));
  return {
    facing: Number(facing[1]),
    spread: grid('@media (min-width: 980px)'),
    rail: grid('@media (min-width: 1256px)'),
    measure: token('--rn-measure'),
    railWidth: token('--rn-rail'),
    bar: token('--rn-bar'),
    widths: [...new Set(spreads)].sort((a, b) => a - b),
  };
}

/** The vocabulary, read off the two files that speak it. */
function vocabulary() {
  const engineSrc = src(join(QUIZ, 'js/embed.js'));
  const roundSrc = src(join(QUIZ, 'js/round.js'));
  const hostSrc = src(join(RUNCIBLE, 'js/quiz-host.js'));
  const outbound = [...new Set([
    ...[...`${engineSrc}${roundSrc}`.matchAll(/post\('(quiz:[a-z-]+)'/g)].map((m) => m[1]),
    ...[...hostSrc.matchAll(/m\.type === '(quiz:[a-z-]+)'/g)].map((m) => m[1]),
  ])];
  const inbound = [...new Set(
    [...engineSrc.matchAll(/case '(quiz:[a-z-]+)':/g)].map((m) => m[1]),
  )];
  if (!outbound.includes('quiz:answer')) throw new Error('quiz:answer is not in the engine any more');
  return { outbound, inbound };
}

const EX = exercises();
const F = filters(EX.quiz);
const S = sets();
const C = corpus();
const B = breakpoints();
const M = vocabulary();

/* One authored exercise, carried through the whole hop. Read from the Book, not
   invented, so the URL below is the URL a reader would get. */
const SAMPLE = EX.quiz.find((e) => e.id === 'e-k-read');
if (!SAMPLE) throw new Error('e-k-read is gone from chapter 1: pick another sample');
const ENV = {
  loc: { hostname: 'runcible.neorgon.com', protocol: 'https:' },
  baseURI: 'https://runcible.neorgon.com/',
  lang: 'en',
  theme: null,
};
const EMBED_URL = host.quizUrl(SAMPLE, { embed: true }, ENV);
const OPEN_URL = host.quizUrl(SAMPLE, { embed: false }, ENV);
const SAMPLE_SET = S.rows.find((r) => r.id === 'jp-hiragana-sound');
/* What the host makes of one wrong answer. Its own function, called. */
const ATTEMPT = host.readAnswer({
  itemId: 'hira-ki', correct: false, ms: 2400, chosen: 'sa', expected: 'ki', skill: 'quiz.sound',
}, SAMPLE);
if (!ATTEMPT.ok) throw new Error('readAnswer refused its own contract');

/* Rappel is in the post but not in a diagram; the count keeps the prose honest. */
const DECKS = readdirSync(join(RAPPEL, 'data/decks'))
  .filter((n) => n.endsWith('.json') && n !== 'index.json')
  .map((n) => j(join(RAPPEL, 'data/decks', n)));

/* ── Small drawing helpers ────────────────────────────────────────────── */

const box = (x, y, w, h, { fill = 'rgba(255,255,255,.04)', stroke = LINE, r = 10, dash = null } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;

const text = (x, y, s, { size = 19, fill = INK, weight = 400, anchor = 'start', mono = false, op = 1 } = {}) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" opacity="${op}"${mono ? ' font-family="ui-monospace, SFMono-Regular, Menlo, monospace"' : ''}>${esc(s)}</text>`;

const arrow = (x1, y1, x2, y2, color, { dash = null, head = true, w = 2 } = {}) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = x2 - Math.cos(a) * 11;
  const hy = y2 - Math.sin(a) * 11;
  return `<line x1="${x1}" y1="${y1}" x2="${hx}" y2="${hy}" stroke="${color}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>`
    + (head ? `<polygon points="${x2},${y2} ${x2 - Math.cos(a - 0.42) * 13},${y2 - Math.sin(a - 0.42) * 13} ${x2 - Math.cos(a + 0.42) * 13},${y2 - Math.sin(a + 0.42) * 13}" fill="${color}"/>` : '');
};

/** Wrap a long string at a character budget, returning lines. */
function wrap(s, n) {
  const words = String(s).split(' ');
  const out = []; let line = '';
  for (const w of words) {
    if ((`${line} ${w}`).trim().length > n) { out.push(line.trim()); line = w; }
    else line = `${line} ${w}`;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

/* ── 01 · Where the drill sits ────────────────────────────────────────── */

function spread() {
  const W = 1240; const H = 1000;
  const b = [];
  b.push(heading(64, 84, 'Runcible', 'The drill moved to the facing page',
    `One layout, three widths. The reading column never changes size, and never moves when a drill starts.`));

  /* The three states, drawn to their real proportions. Track widths are the
     stylesheet's own, scaled to fit the canvas. */
  const scale = 0.55;
  const rail = 220 * scale;
  const prose = 660 * scale;      // --rn-measure 66ch at the 10px/ch the drawing uses
  const recto = 320 * scale;      // minmax(20rem, 22rem), drawn at its floor
  const gap = 24 * scale;

  const lanes = [
    {
      label: `${B.widths.filter((w) => w >= 1256)[0]}px and up`,
      note: 'contents come out of the bar and into the margin',
      tracks: [
        { w: rail, kind: 'rail', name: 'contents' },
        { w: prose, kind: 'prose', name: 'the chapter' },
        { w: 2, kind: 'fold', name: '' },
        { w: recto, kind: 'recto', name: 'the drill' },
      ],
    },
    {
      label: `${B.facing}px to ${B.widths.filter((w) => w >= 1256)[0] - 1}px`,
      note: 'contents collapse to a 40px bar under the header',
      tracks: [
        { w: prose, kind: 'prose', name: 'the chapter' },
        { w: 2, kind: 'fold', name: '' },
        { w: recto, kind: 'recto', name: 'the drill' },
      ],
    },
    {
      label: `below ${B.facing}px`,
      note: 'one column, and the drill mounts under its own marker',
      tracks: [
        { w: prose, kind: 'prose', name: 'the chapter, with the drill inline' },
      ],
    },
  ];

  let y = 228;
  for (const lane of lanes) {
    const total = lane.tracks.reduce((a, t) => a + t.w, 0) + gap * (lane.tracks.length - 1);
    let x = 64;
    b.push(text(64, y - 18, lane.label, { size: 20, weight: 700, fill: INK }));
    b.push(text(64 + total + 30, y + 78, lane.note, { size: 17, fill: MUTE }));
    for (const t of lane.tracks) {
      if (t.kind === 'fold') {
        b.push(`<rect x="${x + gap / 2 - 1}" y="${y - 6}" width="2" height="${152}" fill="${LINE}"/>`);
        x += t.w + gap;
        continue;
      }
      const isRecto = t.kind === 'recto';
      b.push(box(x, y, t.w, 140, {
        fill: isRecto ? `${C_QUIZ}22` : 'rgba(255,255,255,.04)',
        stroke: isRecto ? C_QUIZ : LINE,
        dash: t.kind === 'rail' ? '5 5' : null,
      }));
      /* Prose lines, so a reading column reads as one. */
      if (t.kind === 'prose') {
        for (let i = 0; i < 6; i += 1) {
          const w = t.w - 28 - (i === 5 ? t.w * 0.38 : 0);
          b.push(`<rect x="${x + 14}" y="${y + 26 + i * 17}" width="${w}" height="6" rx="3" fill="rgba(255,255,255,.16)"/>`);
        }
      }
      if (t.kind === 'rail') {
        for (let i = 0; i < 5; i += 1) {
          b.push(`<rect x="${x + 12}" y="${y + 24 + i * 17}" width="${t.w - 40}" height="6" rx="3" fill="rgba(255,255,255,.13)"/>`);
        }
        b.push(`<rect x="${x + 2}" y="${y + 55}" width="4" height="20" rx="2" fill="${C_RUNCIBLE}"/>`);
      }
      if (isRecto) {
        b.push(text(x + 14, y + 34, 'Try it', { size: 14, weight: 700, fill: C_QUIZ }));
        for (let i = 0; i < 3; i += 1) {
          b.push(box(x + 14, y + 48 + i * 28, t.w - 28, 22, { fill: 'rgba(255,255,255,.06)', stroke: 'rgba(255,255,255,.12)', r: 6 }));
          b.push(box(x + 18, y + 51 + i * 28, 16, 16, { fill: `${C_QUIZ}44`, stroke: C_QUIZ, r: 4 }));
        }
      }
      b.push(text(x + t.w / 2, y + 166, t.name, { size: 16, fill: DIM, anchor: 'middle' }));
      x += t.w + gap;
    }
    y += 216;
  }

  /* The one thing that can silently disagree. */
  const noteY = 916;
  b.push(box(64, noteY - 42, 1112, 62, { fill: 'rgba(255,255,255,.03)', stroke: LINE, r: 12 }));
  b.push(text(88, noteY - 4, `css/style.css  @media (min-width: ${B.facing}px)`, { size: 17, mono: true, fill: DIM }));
  b.push(text(560, noteY - 4, '=', { size: 22, fill: C_RUNCIBLE, weight: 700 }));
  b.push(text(600, noteY - 4, `js/render-mount.js  const FACING = '(min-width: ${B.facing}px)'`, { size: 17, mono: true, fill: DIM }));
  b.push(footnote(64, noteY + 56, `Reading column ${B.measure}; contents rail ${B.railWidth}; page bar ${B.bar}. Read from css/style.css and js/render-mount.js at build time.`));
  return frame(W, H, b.join('\n'));
}

/* ── 02 · The hop, and the evidence coming back ───────────────────────── */

function hop() {
  const W = 1240; const H = 1120;
  const b = [];
  b.push(heading(64, 84, CONTRACT, 'One URL out, the evidence back',
    `Runcible imports none of Quiz. ${EX.byType.get('quiz')} of its ${EX.total} exercises run inside another origin.`));

  const LX = 64; const RX = 700; const CW = 476; const TOP = 208;

  /* Two panes. */
  b.push(box(LX, TOP, CW, 300, { fill: `${C_RUNCIBLE}14`, stroke: C_RUNCIBLE, r: 14 }));
  b.push(text(LX + 22, TOP + 38, 'runcible.neorgon.com', { size: 21, weight: 700, fill: C_RUNCIBLE }));
  b.push(text(LX + 22, TOP + 64, 'the chapter, and the host', { size: 17, fill: MUTE }));
  b.push(box(RX, TOP, CW, 300, { fill: `${C_QUIZ}14`, stroke: C_QUIZ, r: 14 }));
  b.push(text(RX + 22, TOP + 38, 'quiz.neorgon.com', { size: 21, weight: 700, fill: C_QUIZ }));
  b.push(text(RX + 22, TOP + 64, 'the game, in an iframe', { size: 17, fill: MUTE }));

  /* The exercise as the Book authored it. */
  const specLines = [
    `"type": "quiz",  "game": "${SAMPLE.game}"`,
    `"src":  "${SAMPLE.src.split('/').slice(-1)[0]}"`,
    `"filter": "${SAMPLE.filter}",  "limit": ${SAMPLE.limit}`,
    `"skill": "${SAMPLE.skill}"`,
  ];
  b.push(box(LX + 22, TOP + 88, CW - 44, 122, { fill: 'rgba(0,0,0,.32)', stroke: LINE, r: 8 }));
  b.push(text(LX + 38, TOP + 112, `${SAMPLE.chapter} · ${SAMPLE.id}`, { size: 14, weight: 700, fill: DIM }));
  specLines.forEach((l, i) => b.push(text(LX + 38, TOP + 138 + i * 21, l, { size: 15, mono: true, fill: INK, op: 0.86 })));
  b.push(text(LX + 22, TOP + 240, 'quizUrl(spec) builds the src, and the same URL', { size: 16, fill: MUTE }));
  b.push(text(LX + 22, TOP + 262, 'without embed and skill is the way out.', { size: 16, fill: MUTE }));

  /* What the round is, on the other side. */
  b.push(box(RX + 22, TOP + 88, CW - 44, 122, { fill: 'rgba(0,0,0,.32)', stroke: LINE, r: 8 }));
  b.push(text(RX + 38, TOP + 112, `${SAMPLE_SET.id}`, { size: 14, weight: 700, fill: DIM }));
  b.push(text(RX + 38, TOP + 138, `${SAMPLE_SET.n} items in the set`, { size: 15, mono: true, fill: INK, op: 0.86 }));
  b.push(text(RX + 38, TOP + 159, `filter ${SAMPLE.filter} keeps the k row`, { size: 15, mono: true, fill: INK, op: 0.86 }));
  b.push(text(RX + 38, TOP + 180, `limit ${SAMPLE.limit} asks ${SAMPLE.limit} of them`, { size: 15, mono: true, fill: INK, op: 0.86 }));
  b.push(text(RX + 22, TOP + 240, 'The strip still draws the whole table, so the', { size: 16, fill: MUTE }));
  b.push(text(RX + 22, TOP + 262, 'row is a round and not a different alphabet.', { size: 16, fill: MUTE }));

  /* The URL, whole, because it is the entire outbound coupling. Down the left
     into the box, up the right out of it: nothing crosses anything. */
  const urlY = TOP + 366;
  b.push(arrow(LX + 406, TOP + 306, LX + 406, urlY + 12, C_RUNCIBLE, { dash: '6 5' }));
  b.push(text(LX, urlY, 'Everything Runcible sends, in the frame src', { size: 17, weight: 700, fill: INK }));
  const urlLines = wrap(decodeURIComponent(EMBED_URL).replace(/&/g, ' &'), 118);
  b.push(box(LX, urlY + 18, 1112, 26 + urlLines.length * 24, { fill: 'rgba(0,0,0,.34)', stroke: LINE, r: 8 }));
  urlLines.forEach((l, i) => b.push(text(LX + 18, urlY + 48 + i * 24, l, { size: 15, mono: true, fill: INK, op: 0.82 })));
  b.push(arrow(RX + 340, urlY + 12, RX + 340, TOP + 306, C_QUIZ, { dash: '6 5' }));

  /* The messages back. */
  const msgY = urlY + 44 + urlLines.length * 24 + 64;
  b.push(text(LX, msgY, `Everything Quiz says back, v: ${V}, to the referrer's origin and never "*"`, { size: 17, weight: 700, fill: INK }));
  const CAPTION = {
    'quiz:ready': ['once the set resolved', MUTE],
    'quiz:answer': ['one per item. this is the evidence', C_QUIZ],
    'quiz:session-end': ['once, as the results screen paints', MUTE],
    'quiz:error': ['the frame shows its own message too', MUTE],
    'quiz:resize': ['debounced 120ms, the host clamps it', MUTE],
  };
  const order = ['quiz:ready', 'quiz:answer', 'quiz:session-end', 'quiz:error', 'quiz:resize']
    .filter((m) => M.outbound.includes(m));
  for (const m of M.outbound) if (!order.includes(m)) order.push(m);
  order.forEach((m, i) => {
    const x = LX + (i < 3 ? 0 : 566);
    const y = msgY + 42 + (i % 3) * 40;
    const isEvidence = m === 'quiz:answer';
    b.push(box(x, y - 22, 268, 32, {
      fill: isEvidence ? `${C_QUIZ}30` : `${C_QUIZ}14`,
      stroke: isEvidence ? C_QUIZ : `${C_QUIZ}55`,
      r: 6,
    }));
    b.push(text(x + 14, y, m, { size: 16, mono: true, fill: INK }));
    const [cap, col] = CAPTION[m] || ['', MUTE];
    if (cap) b.push(text(x + 286, y, cap, { size: 15, fill: col }));
  });

  /* The conversion, which is the whole point. */
  const cy = msgY + 172;
  b.push(box(LX, cy, 1112, 104, { fill: 'rgba(255,255,255,.03)', stroke: C_RUNCIBLE, r: 12 }));
  b.push(text(LX + 22, cy + 34, 'One quiz:answer becomes one attempt, under the exercise’s skill and not the game’s', { size: 18, weight: 700, fill: INK }));
  const at = ATTEMPT.attempt;
  b.push(text(LX + 22, cy + 64, `{ itemId: "${at.itemId}", skill: "${at.skill}", correct: ${at.correct}, ms: ${at.ms}, answer: "${at.answer}", expected: "${at.expected}" }`, { size: 15, mono: true, fill: INK, op: 0.86 }));
  b.push(text(LX + 22, cy + 90, 'An answer the host cannot read, or the recorder refuses, is said on the page, and the round is not reported as finished.', { size: 16, fill: MUTE }));

  b.push(footnote(64, cy + 150, 'The URL is built by calling js/quiz-host.js quizUrl(), and the attempt is what its readAnswer() returns, for the exercise chapter 1 actually'));
  b.push(footnote(64, cy + 176, 'authored. The message names are read out of quiz-site/js/embed.js, quiz-site/js/round.js and js/quiz-host.js at build time.'));
  return frame(W, H, b.join('\n'));
}

/* ── 03 · One source, written twice ───────────────────────────────────── */

function pipeline() {
  const W = 1240; const H = 720;
  const b = [];
  b.push(heading(64, 84, 'tools/build-sets.mjs', 'One source, written twice',
    `${S.rows.length} sets, ${S.items} items. Neither copy is authored, and the writer compares them.`));

  const inputs = [
    { label: 'data/kana/*.json', detail: `${C.kana} kana in two tables` },
    { label: 'data/loanwords/', detail: `${C.loanwords} words, ${C.rules} rules` },
    { label: 'data/songs/', detail: `${C.songs} songs` },
    { label: 'data/vocab/ch4.json', detail: `${C.vocab} first words` },
    { label: 'tools/selection/sets.json', detail: `${SELECTION.sets.length} declarations, and the Spanish` },
  ];

  const IX = 64; const IW = 300;
  let y = 216;
  b.push(text(IX, y - 22, 'The corpus, in Runcible', { size: 18, weight: 700, fill: INK }));
  for (const inp of inputs) {
    b.push(box(IX, y, IW, 62, { fill: 'rgba(255,255,255,.04)', stroke: LINE, r: 8 }));
    b.push(text(IX + 16, y + 26, inp.label, { size: 16, mono: true, fill: INK }));
    b.push(text(IX + 16, y + 48, inp.detail, { size: 15, fill: MUTE }));
    b.push(arrow(IX + IW + 6, y + 31, 470, 380, C_RUNCIBLE, { dash: '5 5', w: 1.5 }));
    y += 76;
  }

  /* The generator. */
  b.push(box(470, 300, 250, 160, { fill: `${C_RUNCIBLE}18`, stroke: C_RUNCIBLE, r: 12 }));
  b.push(text(595, 336, 'build-sets.mjs', { size: 19, weight: 700, fill: INK, anchor: 'middle' }));
  b.push(text(595, 362, 'a manual data step,', { size: 15, fill: MUTE, anchor: 'middle' }));
  b.push(text(595, 382, 'never wired into a build', { size: 15, fill: MUTE, anchor: 'middle' }));
  b.push(text(595, 414, 'ids come from corpus ids,', { size: 15, fill: INK, anchor: 'middle', op: 0.9 }));
  b.push(text(595, 434, 'never from position', { size: 15, fill: INK, anchor: 'middle', op: 0.9 }));

  /* Two outputs. */
  const outs = [
    {
      x: 800, y: 232, site: 'quiz-site', path: 'data/sets/',
      sub: `${S.rows.length} sets, and index.json`, color: C_QUIZ, foot: S.indexFormat,
    },
    {
      x: 800, y: 440, site: 'runcible-site', path: `books/${BOOK}/sets/`,
      sub: `${S.rows.length} sets, the copy a chapter embeds`, color: C_RUNCIBLE,
      foot: 'declared in book.json, or the host refuses to mount',
    },
  ];
  for (const o of outs) {
    b.push(box(o.x, o.y, 376, 112, { fill: `${o.color}14`, stroke: o.color, r: 12 }));
    b.push(text(o.x + 18, o.y + 30, o.site, { size: 16, weight: 700, fill: o.color }));
    b.push(text(o.x + 18, o.y + 54, o.path, { size: 16, mono: true, fill: INK }));
    b.push(text(o.x + 18, o.y + 78, o.sub, { size: 15, fill: MUTE }));
    b.push(text(o.x + 18, o.y + 100, o.foot, { size: 14, fill: MUTE, op: 0.8 }));
    b.push(arrow(724, 380, o.x - 8, o.y + 56, o.color, { w: 2 }));
  }

  /* The comparison. This is the claim. */
  b.push(`<line x1="988" y1="344" x2="988" y2="440" stroke="${LINE}" stroke-width="2" stroke-dasharray="4 4"/>`);
  b.push(box(888, 358, 200, 68, { fill: BG, stroke: INK, r: 10 }));
  b.push(text(988, 386, `${S.identical} of ${S.rows.length}`, { size: 24, weight: 700, fill: INK, anchor: 'middle' }));
  b.push(text(988, 410, 'byte for byte', { size: 15, fill: MUTE, anchor: 'middle' }));

  b.push(text(64, 640, 'The writer reads both files back and throws when they differ, so "the two copies agree" is not a habit anybody has to keep.', { size: 18, fill: INK, op: 0.9 }));
  const games = [...S.games.entries()].map(([g, n]) => `${g} ${n}`).join(' · ');
  b.push(footnote(64, 676, `Games: ${games}. Counts and the sha256 comparison computed over both trees when this diagram was drawn.`));
  return frame(W, H, b.join('\n'));
}

/* ── Write ────────────────────────────────────────────────────────────── */

emit({
  '01-spread.svg': spread(),
  '02-embed-hop.svg': hop(),
  '03-set-pipeline.svg': pipeline(),
}, HERE, { writeFileSync, join });

/* Everything the prose is allowed to assert, printed so the numbers in POST.md
   can be checked against this run rather than against memory. */
const facts = {
  chapters: EX.chapters,
  rungs: EX.rungs,
  pages: EX.pages,
  exercises: EX.total,
  byType: Object.fromEntries([...EX.byType].sort((a, b) => b[1] - a[1])),
  quizRounds: EX.byType.get('quiz'),
  filtered: F.filtered,
  unfiltered: F.unfiltered,
  filterFields: Object.fromEntries(F.byField),
  filterFieldsAllowed: spec.QUIZ_FILTER_FIELDS,
  genericTypes: spec.GENERIC_TYPES.length,
  sets: S.rows.length,
  setItems: S.items,
  setGames: Object.fromEntries(S.games),
  byteIdentical: `${S.identical}/${S.rows.length}`,
  setsWithNoSpanishName: S.rows.filter((r) => r.noSpanishName).length,
  contract: CONTRACT,
  protocol: V,
  gamesQuizShips: host.GAMES,
  outbound: M.outbound,
  inbound: M.inbound,
  loanwords: C.loanwords,
  beatSplits: C.splits,
  rules: C.rules,
  rulesExplained: C.explained,
  facingBreakpoint: B.facing,
  breakpoints: B.widths,
  measure: B.measure,
  rappelDecks: DECKS.length,
  rappelNotes: DECKS.reduce((a, d) => a + (d.notes || d.cards || []).length, 0),
  embedUrl: EMBED_URL,
  openUrl: OPEN_URL,
};
console.log(`\n${JSON.stringify(facts, null, 2)}`);
