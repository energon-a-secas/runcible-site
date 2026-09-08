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
 *    piece rather than per composer. tools/lib/piano-upstream.mjs reads that
 *    tag and maps it to an SPDX id from a closed table; an unmapped tag stops
 *    the run. A file's `_licence` block is one object (C11.2), so it can name
 *    one licence and one engraver: the run below asserts that every piece
 *    written into one file agrees on both, and says which file to split when
 *    they do not.
 *
 * 2. The notes. The `.ly` source carries the spelling the score prints, so
 *    F sharp arrives as `fis` and never has to be guessed back out of a pitch
 *    number. tools/lib/piano-lily.mjs is deliberately narrow: it follows one
 *    named staff, and a bar is kept only when it holds no chord, no polyphony
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
 *
 * The work is four modules and this file is the entry point. It reads the
 * selection, loops over the output files, holds each one to the one-licence
 * rule, writes it and prints the counts. Everything else is under tools/lib/:
 *
 *   piano-upstream.mjs   the fetch, the cache, the .rdf tags, the SPDX table
 *   piano-lily.mjs       the reader: one named staff of a .ly, turned into bars
 *   piano-notation.mjs   key signatures, and which notes print an accidental
 *   piano-pieces.mjs     one piece record, and the _licence block that carries it
 *
 * extractBlock and readVoice are re-exported below because they were exported
 * from this path before the split, and a module's callers should not have to
 * care that its insides moved.
 */
import path from 'node:path';
import { SITE, writeData, readSelection, fmtBytes } from './lib/corpus.mjs';
import { SPDX } from './lib/piano-upstream.mjs';
import { buildPiece, licenceFor } from './lib/piano-pieces.mjs';

export { extractBlock, readVoice } from './lib/piano-lily.mjs';

const BUDGET_KB = 60;

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
