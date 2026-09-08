#!/usr/bin/env node
/**
 * data/reading/<story>.json, sliced out of Aozora Bunko's own text archives.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 *
 *   node tools/build-reading.mjs
 *
 * Never wire it into CI or `make serve`. It downloads a 2.1 MB index and one
 * small zip per story, and it shells out to `unzip`.
 *
 * Aozora's reuse terms for copyright-expired works permit free copying,
 * redistribution and format conversion (aozora.gr.jp/guide/kijyunn.html), and
 * the bibliography CSV this script filters on is CC BY 4.0. Nothing here is
 * fetched from a source with no licence grant.
 *
 * The selection file pins card ids and nothing else. Every safety judgment is
 * re-derived from the index on each run rather than trusted from the
 * selection, so a story cannot drift into the corpus on a stale note:
 *
 *   1. orthography must be the modern one. Aozora publishes several of these
 *      stories twice, once in the 1940s spelling, and teaching a beginner an
 *      orthography abandoned in 1946 is the trap the research named.
 *   2. the work copyright flag must be the expired one.
 *   3. every contributor on the card, translators included, must have died in
 *      1945 or earlier. That is what makes the work public domain in the US as
 *      well as in Japan: it was already out of copyright at home on the 1996
 *      URAA date, so nothing was restored.
 *   4. the decoded text must carry no U+FFFD. Aozora ships Shift_JIS only, and
 *      a mis-decode is mojibake no licence check can see.
 *
 * Output per story: the passage split into sentences, `chunks[]` for an order
 * drill, `pairs[]` for a next-sentence choice, and `ruby[]` for a typed
 * reading drill, every one derived from the file. Not one string of language
 * in the output was written by a person.
 *
 * WHERE THE WORK LIVES. This file is the entry point and the contract above;
 * each stage is a module of its own, and none of them is over 500 lines:
 *   lib/reading-aozora.mjs   the download cache and the bibliography index
 *   lib/reading-text.mjs     the Aozora text file format, all of it pure
 *   lib/reading-licence.mjs  the four safety checks and the licence block
 *   lib/reading-doc.mjs      one card into one neo-reading/1 document
 */
import { readSelection } from './lib/corpus.mjs';
import { loadIndex } from './lib/reading-aozora.mjs';
import { build, refuse } from './lib/reading-doc.mjs';

function main() {
  const selection = readSelection('reading.json');
  const index = loadIndex();
  process.stdout.write(
    `Aozora index: ${index.rows} contributor rows, ${index.works} works, `
    + `${index.bytes} bytes, sha256 ${index.sha256}\n`);

  let built = 0;
  for (const sel of selection.stories) {
    if (!sel.build) {
      process.stdout.write(`  card ${sel.card}  held, not built: ${sel.hold}\n`);
      continue;
    }
    if (!sel.read_by) { refuse(sel.card, 'no read_by record, so nobody has read this story'); continue; }
    if (build(sel, index, selection)) built += 1;
  }
  process.stdout.write(`${built} stories written to data/reading/\n`);
}

main();
