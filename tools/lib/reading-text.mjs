/**
 * The Aozora text file format: header and footer off, editorial notes out,
 * paragraphs into sentences, and the furigana read off base and reading.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. See tools/build-reading.mjs.
 *
 * Every function here is pure and none of them opens a file, so the same three
 * passes can be run over a decoded string in a test without a download. Not
 * one string of language leaves this file that did not arrive in it.
 */

const RULE = /^-{20,}$/;
const INDENT_OPEN = /^［＃ここから.*字下げ］$/;
const INDENT_CLOSE = /^［＃ここで字下げ終わり］$/;
const NOTE = /［＃[^］]*］/g;
const FOOTER = /^底本[：:]/;

/**
 * Header, footer and editorial notes out; the body's own lines back.
 *
 * The lines of an indented block are joined into one unit with the full-width
 * space, which is the separator these files already use between words. Left
 * as separate lines, a four-line chant becomes four one-word sentences and an
 * order drill fills up with them.
 */
export function bodyLines(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  i += 1; // the title
  while (i < lines.length && lines[i].trim() !== '') i += 1; // the author block
  if (lines.slice(i, i + 6).some((l) => RULE.test(l.trim()))) {
    while (i < lines.length && !RULE.test(lines[i].trim())) i += 1;
    i += 1;
    while (i < lines.length && !RULE.test(lines[i].trim())) i += 1;
    i += 1;
  }
  const out = [];
  let block = null;
  for (; i < lines.length; i += 1) {
    const raw = lines[i];
    if (FOOTER.test(raw)) break;
    if (INDENT_OPEN.test(raw.trim())) { block = []; continue; }
    if (INDENT_CLOSE.test(raw.trim())) {
      if (block && block.length) out.push(block.join('　'));
      block = null;
      continue;
    }
    const line = raw.replace(NOTE, '').trim();
    if (line === '') continue;
    if (block) block.push(line);
    else out.push(line.replace(/^　/, ''));
  }
  if (block && block.length) out.push(block.join('　'));
  return out;
}

const OPENERS = new Set(['「', '『', '（', '〔', '【']);
const CLOSERS = new Set(['」', '』', '）', '〕', '】']);
const ENDERS = new Set(['。', '！', '？']);

/**
 * One paragraph into sentences. A full stop inside a quotation does not end a
 * sentence; the closing bracket after it does. Splitting on the stop alone
 * cuts every line of dialogue in these stories in half.
 */
export function splitSentences(paragraph) {
  const out = [];
  let cur = '';
  let depth = 0;
  let ended = false;
  for (const ch of paragraph) {
    cur += ch;
    if (OPENERS.has(ch)) { depth += 1; ended = false; continue; }
    if (CLOSERS.has(ch)) {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && ended) { out.push(cur); cur = ''; ended = false; }
      continue;
    }
    if (ENDERS.has(ch)) {
      if (depth === 0) { out.push(cur); cur = ''; ended = false; } else ended = true;
      continue;
    }
    ended = false;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

const IDEOGRAPH = /[々〇一-鿿ヶヵ]/;

function trailingBase(plain) {
  let i = plain.length;
  while (i > 0 && IDEOGRAPH.test(plain[i - 1])) i -= 1;
  return plain.slice(i);
}

/**
 * Aozora's plain text writes furigana as base《reading》, with the vertical
 * bar marking where the base begins when the run before it is ambiguous. The
 * XHTML carries the same information as native ruby elements; this is the
 * same data without an HTML parse.
 */
export function parseRuby(text) {
  let plain = '';
  let bar = null;
  const found = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '｜') { bar = plain.length; i += 1; continue; }
    if (ch === '《') {
      const close = text.indexOf('》', i);
      if (close < 0) { plain += ch; i += 1; continue; }
      const reading = text.slice(i + 1, close);
      const base = bar === null ? trailingBase(plain) : plain.slice(bar);
      if (base && reading) found.push({ base, reading });
      bar = null;
      i = close + 1;
      continue;
    }
    plain += ch;
    i += 1;
  }
  return { plain, found };
}
