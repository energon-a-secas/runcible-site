// A Book's tools and its reading runs: the half of the reader integration that
// needs no DOM, so tools/lib/validate-manifest.mjs, a node test and the page
// hold one notion of valid. Nothing in here knows what a Book teaches.
//
// Both keys are optional (C1.4: adding an optional field is safe):
//
//   "tools": [{ "id": "reader", "embed": "yomu", "title": {en, es},
//               "glyph": "...", "description": {en, es}, "reads": true }]
//   "lang":  { "content": "<tag>", "ui": [...], "runs": "<regexp source>" }
//
// A tool is a page a sibling site draws in a frame, beside the chapters, and
// it records nothing: no attempt, no evidence, no progress row. `embed` is
// checked against a frozen list the way a quiz game is, so a Book cannot point
// a frame at an origin this shell has not agreed a protocol with.
//
// `runs` names the stretches of the content language inside mixed text (a
// word in the target language inside an English sentence). The shell marks
// each one with lang="<content>" so it is drawn and spoken as that language,
// and when a tool also reads, each one opens that tool. The pattern is
// compiled here and never interpreted, which is what keeps this file free of
// any one script.

/** The sites a tool may embed. Any other value is refused at load. */
export const TOOL_EMBEDS = Object.freeze(['yomu']);

/** The fields a tool carries. Anything else is warned about, never read. */
export const TOOL_FIELDS = Object.freeze(['id', 'embed', 'title', 'glyph', 'description', 'reads']);

/** Flags every runs pattern is compiled with, by the validator and the page alike. */
export const RUNS_FLAGS = 'gu';

// One letter from several scripts, plus space, digit and punctuation. A
// pattern that finds a zero-length match in any of these would mark runs of
// nothing: an empty span, or a button with no name.
const PROBES = ['', ' ', 'a', '1', '.', 'é', 'Ж', 'α', 'ا', 'א',
  'क', 'ก', 'あ', 'ア', '中', '한', 'a あ 1. 中。 Ж'];

/**
 * Compile a lang.runs source. Returns { re } or { error }, never throws.
 * Refused: not a string, empty, does not compile with the u flag, or able to
 * match the empty string. The empty-match test is the whole pattern against
 * "" plus a zero-length match anywhere in the probes, which catches the
 * lookaround-only shapes (\b, (?=x)) that pass the first test.
 */
export function compileRuns(src) {
  if (typeof src !== 'string' || src === '') return { error: 'must be a non-empty regular-expression source string' };
  let re;
  try {
    re = new RegExp(src, RUNS_FLAGS);
  } catch (e) {
    return { error: `does not compile with the "${RUNS_FLAGS}" flags: ${e.message}` };
  }
  if (new RegExp(`^(?:${src})$`, 'u').test('')) {
    return { error: 'can match the empty string, so it would mark runs of nothing' };
  }
  for (const probe of PROBES) {
    for (const m of probe.matchAll(re)) {
      if (m[0] === '') return { error: `can match the empty string (found one in ${JSON.stringify(probe)}), so it would mark runs of nothing` };
    }
  }
  return { re };
}

const compiled = new WeakMap();   // book manifest -> RegExp | null

/** The compiled runs pattern of a Book, or null when it declares none. */
export function runsFor(book) {
  if (!book || typeof book !== 'object') return null;
  if (compiled.has(book)) return compiled.get(book);
  const src = book.lang && book.lang.runs;
  const re = typeof src === 'string' ? compileRuns(src).re || null : null;
  compiled.set(book, re);
  return re;
}

/** The content language tag, or null. */
export function contentLang(book) {
  const tag = book && book.lang && book.lang.content;
  return typeof tag === 'string' && tag ? tag : null;
}

/**
 * Split text into plain strings and { run } pieces. Whitespace at either end
 * of a match stays outside the run, so a pattern that swallows a space does
 * not underline it. A zero-length match is skipped rather than trusted.
 */
export function splitRuns(text, re) {
  const s = text === null || text === undefined ? '' : String(text);
  if (!re || !s) return [s];
  const out = [];
  let at = 0;
  for (const m of s.matchAll(re)) {
    const whole = m[0];
    const run = whole.trim();
    if (!run) continue;
    const start = m.index + whole.indexOf(run);
    if (start > at) out.push(s.slice(at, start));
    out.push({ run });
    at = start + run.length;
  }
  if (at < s.length) out.push(s.slice(at));
  return out.length ? out : [s];
}

/** The tools a Book declares that this shell can draw, in manifest order. */
export function toolsOf(book) {
  const list = book && Array.isArray(book.tools) ? book.tools : [];
  return list.filter((tool) => tool && typeof tool.id === 'string' && TOOL_EMBEDS.includes(tool.embed));
}

/** One tool by id, or the first one when no id is given. */
export function findTool(book, id) {
  const tools = toolsOf(book);
  return (id ? tools.find((tool) => tool.id === id) : tools[0]) || null;
}

/** The tool a tapped run opens: the first one that reads, or null. */
export function readingTool(book) {
  return toolsOf(book).find((tool) => tool.reads === true) || null;
}
