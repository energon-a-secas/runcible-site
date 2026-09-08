/**
 * Quiz sets, the order game: one set per song, one item per line, the pieces
 * cut on the word boundaries the corpus's own romaji line records and aligned
 * back onto the kana.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. See tools/build-sets.mjs.
 *
 * The songs are public domain and a set carries the authors' death years,
 * because they are the whole basis of the verdict. The verse gloss is the
 * researcher's English; the Spanish is the selection file's (glosses_es), and
 * a verse it does not name ships with es null.
 */
import { GENERATED_AT } from './corpus.mjs';
import { TOOL, readData, skip } from './sets-common.mjs';
import { toHiragana } from '../../js/vendor/wanakana.js';

/**
 * The pieces of a song line, cut on the word boundaries the corpus records.
 *
 * The kana line carries a space at the phrase break only ("ここはどこの
 * ほそみちじゃ"), so cutting there gives two pieces and a two-piece order is a
 * coin flip (design review, 2026-09-05). The same verse carries a romaji line
 * with every word apart ("koko wa doko no hosomichi ja"), so each romaji word
 * is converted to hiragana and matched in turn against the kana with the
 * spaces removed; when every word lands and nothing is left over, those are
 * the pieces. Three joins follow, none of them a judgment about Japanese:
 * a one-kana piece joins the piece before it (は, の, を: a particle chip
 * carries no melody; the first piece joins the one after it instead), a
 * piece repeated straight after itself is one piece ("よい よい", a refrain),
 * and a piece that still reads the same as another joins the piece before it,
 * so two chips never read the same and there is exactly one right order.
 *
 * A line whose romaji does not align (a small ぁ the romaji writes plain, a
 * word the researcher spelt another way) falls back to the corpus's spaces and
 * says so; a line that still has fewer than three pieces is skipped and
 * reported, never padded. Every piece is a substring of the corpus line.
 */
const PARTICLE_ROMAJI = { wa: 'は', o: 'を', e: 'へ' };

function kanaCandidates(word) {
  const out = new Set([toHiragana(word)]);
  if (PARTICLE_ROMAJI[word]) out.add(PARTICLE_ROMAJI[word]);
  if (word.endsWith('wa')) out.add(toHiragana(word.slice(0, -2)) + 'は');
  // The researcher writes Hepburn zu and ji; the kana may be づ or ぢ.
  for (const [from, to] of [['zu', 'du'], ['ji', 'di']]) {
    if (word.includes(from)) out.add(toHiragana(word.split(from).join(to)));
  }
  return [...out].filter(Boolean);
}

/** The romaji words matched onto the kana, or null when they do not fit. */
export function alignRomaji(kanaLine, romajiLine) {
  const flat = kanaLine.replace(/\s+/g, '');
  const words = String(romajiLine || '').toLowerCase().replace(/[,.;:!?"]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const pieces = [];
  let pos = 0;
  for (const word of words) {
    const hit = kanaCandidates(word).find((c) => c && flat.startsWith(c, pos));
    if (!hit) return null;
    pieces.push(hit);
    pos += hit.length;
  }
  return pos === flat.length ? pieces : null;
}

/** One code point: a lone kana, not a digraph like じゃ. */
const isOneKana = (piece) => [...piece].length === 1;

/** The three joins. Pure; exported for the check in tools/. */
export function joinPieces(pieces) {
  let out = [];
  for (const piece of pieces) {
    if (isOneKana(piece) && out.length) out[out.length - 1] += piece;
    else out.push(piece);
  }
  if (out.length > 1 && isOneKana(out[0])) out.splice(0, 2, out[0] + out[1]);
  // A refrain: a run of pieces repeated straight after itself, at any period.
  let merged = true;
  while (merged) {
    merged = false;
    for (let period = 1; period <= out.length / 2 && !merged; period += 1) {
      for (let i = 0; i + 2 * period <= out.length; i += 1) {
        const a = out.slice(i, i + period);
        const b = out.slice(i + period, i + 2 * period);
        if (a.every((x, k) => x === b[k])) {
          out.splice(i, 2 * period, [...a, ...b].join(' '));
          merged = true;
          break;
        }
      }
    }
  }
  // Two pieces that still read the same: the first joins the piece before it.
  for (let guard = 0; guard < 9; guard += 1) {
    const seen = new Map();
    const dup = out.findIndex((p, i) => (seen.has(p) ? true : (seen.set(p, i), false)));
    if (dup === -1) break;
    const first = out.indexOf(out[dup]);
    const at = first > 0 ? first : dup;
    out.splice(at - 1, 2, `${out[at - 1]} ${out[at]}`);
  }
  return out;
}

/** The pieces for one line: aligned romaji when it fits, else the corpus spaces. */
export function songPieces(kanaLine, romajiLine) {
  const aligned = alignRomaji(kanaLine, romajiLine);
  const raw = aligned || kanaLine.trim().split(/\s+/).filter(Boolean);
  return { tokens: joinPieces(raw), aligned: !!aligned };
}

export function songSets(spec) {
  const index = readData(spec.from);
  const out = [];
  for (const row of index.songs) {
    const song = readData(row.src.replace(/^data\//, ''));
    const setId = spec.id.replace('{song}', song.id);
    const items = [];
    let aligned = 0;
    let spanish = 0;
    for (const verse of song.verses) {
      // The gloss is the researcher's English, one per verse, and every line of
      // the verse shows it. The Spanish is the selection file's, keyed by song
      // and verse; a verse it does not name ships with es null.
      const verseEs = spec.glosses_es?.[song.id]?.[String(verse.n)];
      if (typeof verseEs !== 'string' || !verseEs.trim()) {
        skip(setId, `${song.id} verse ${verse.n}: tools/selection/sets.json carries no Spanish gloss, so every line of it falls back to English`);
      } else spanish += 1;
      verse.lines.forEach((line, i) => {
        const id = `${song.id}-v${verse.n}-l${i + 1}`;
        const romaji = Array.isArray(verse.romaji_lines) ? verse.romaji_lines[i] : null;
        const cut = songPieces(line, romaji);
        if (!cut.aligned) skip(setId, `${id} "${line}": the romaji "${romaji}" does not align with the kana, so the pieces are the corpus's spaces`);
        const { tokens } = cut;
        if (tokens.length < 3) return skip(setId, `${id} "${line}" has ${tokens.length} piece${tokens.length === 1 ? '' : 's'} once repeats are joined; fewer than three is no puzzle`);
        if (tokens.length > 9) return skip(setId, `${id} "${line}" has ${tokens.length} pieces and the bank stops at 9`);
        if (cut.aligned) aligned += 1;
        items.push({
          id,
          tokens,
          line: tokens.join(' '),
          gloss: { en: verse.gloss, es: typeof verseEs === 'string' && verseEs.trim() ? verseEs.trim() : null },
        });
        return undefined;
      });
    }
    if (!items.length) { skip(setId, 'no line with three or more pieces; set not written'); continue; }
    const t = song.title;
    const c = song.credits;
    const title = `${t.ja} (${t.romaji})`;
    const lic = song._licence;
    const attribution = `${title}. Words: ${c.lyricist}. Music: ${c.composer}. First published ${c.first_published}. Public domain in Japan and the United States.`;
    out.push({
      id: setId,
      name: { en: title, es: null },
      skill: spec.skill,
      budget_kb: spec.budget_kb,
      built: {
        lang: 'ja',
        licence: { spdx: 'public-domain', screen: 'none', attribution, source: lic.url },
        _licence: {
          ...lic,
          generated_by: TOOL,
          generated_at: GENERATED_AT,
          note: `Derived from ${row.src}: one item per line, the pieces cut on the word boundaries of the corpus's romaji line aligned onto the kana (a one-kana piece joins the piece before it, a repeated piece is one piece), the verse gloss shown after a miss. Verdicts, credits and the authors' death years are copied from that file.${t.qualifier ? ` Qualifier: ${t.qualifier}.` : ''}`,
        },
        items,
        summary: `${items.length} lines, ${aligned} cut on the romaji's words, ${spanish} of ${song.verses.length} verse glosses in Spanish`,
      },
    });
  }
  return out;
}
