/**
 * One piece, read out of its own engraving, and the licence block that carries it.
 *
 * Split out of tools/build-piano.mjs, which is the entry point and the only
 * thing that runs. This is where the two halves meet: the upstream fetch hands
 * over a `.rdf` and a `.ly`, the reader turns the named staff into bars, and
 * what comes back is the record a chapter points at.
 *
 * The dropping happens here and it is counted, never silent. A bar is kept only
 * when the reader refused nothing in it and its written durations add up to the
 * time signature exactly. Everything else lands in `read.refused` with the
 * reason and a count, so a piece whose upper staff is chordal ships with its
 * licence and its credits and with no drillable bar, which is a named gap in
 * chapter 4 rather than a guess.
 */
import fs from 'node:fs';
import { fetchFile, parseRdf, sha256 } from './piano-upstream.mjs';
import { UNIT, extractBlock, readVoice } from './piano-lily.mjs';
import { NAMES, accidental, keySignature, markAccidentals } from './piano-notation.mjs';

/**
 * The entry point's own path, and the date the committed data was generated.
 * Both are written into every `_licence` block, so TOOL names the command an
 * operator runs rather than this file: what a reader of data/piano/*.json needs
 * is the thing to re-run, and that has never been a module under lib/.
 */
export const TOOL = 'tools/build-piano.mjs';
export const GENERATED_AT = '2026-09-08';

export function licenceFor(spdx, mutopiaLicence, maintainer, dirs) {
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

export function buildPiece(base, row) {
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
  // A key signature names two keys, and an engraving declares only the one its
  // typesetter chose to write. The Wild Horseman is engraved as \key c \major
  // and is in A minor: it opens on E and A, uses G sharp as a leading note and
  // cadences on A. A row may therefore name the key itself, and the assertion
  // is what keeps that a reading of the same signature rather than a second
  // opinion about it: an override whose fifths differ from the engraving's
  // stops the run, because `fifths` is what draws the accidentals.
  const named = row.key ? keySignature(row.key) : null;
  if (named && named.fifths !== sig.fifths) {
    throw new Error(`${row.id}: key override ${named.tonic} ${named.mode} is ${named.fifths} fifths, and the engraving declares ${sig.fifths}`);
  }
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
      key: (named || sig).tonic,
      mode: (named || sig).mode,
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
