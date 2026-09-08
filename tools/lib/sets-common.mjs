/**
 * Quiz sets: the pieces every builder under tools/lib/sets-*.mjs shares.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. tools/build-sets.mjs is the entry
 * point and its header is the contract for the whole pipeline. This file holds
 * only what more than one builder needs, so no two of them invent it
 * differently, and it decides nothing about any game.
 *
 * `skipped` is one array for the whole run. An ES module is a singleton, so
 * every builder pushes onto this same list and the entry prints it after the
 * last set is written: that is the mechanism behind the rule that nothing a
 * run could not derive is ever silently dropped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './corpus.mjs';

/**
 * The generator name every licence block carries. It stays the entry point's
 * path after the split, because that is the command an operator runs and the
 * thing a reader of a written set needs to be able to re-run.
 */
export const TOOL = 'tools/build-sets.mjs';

/** Everything this run could not derive, printed at the end and never hidden. */
export const skipped = [];
export function skip(setId, what) { skipped.push(`${setId}: ${what}`); }

export function readData(rel) {
  const abs = path.join(SITE, 'data', rel);
  if (!fs.existsSync(abs)) { process.stderr.write(`missing ${abs}\n`); process.exit(1); }
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

/** { en, es } from a corpus value that may be a string, an object or absent. */
export function bilingual(v) {
  if (typeof v === 'string') return { en: v, es: null };
  if (!v || typeof v !== 'object') return null;
  const en = typeof v.en === 'string' ? v.en : null;
  const es = typeof v.es === 'string' ? v.es : null;
  return en === null && es === null ? null : { en, es };
}
