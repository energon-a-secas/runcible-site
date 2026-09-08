/**
 * The safety checks, and the licence block they justify.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. See tools/build-reading.mjs.
 *
 * Every judgment is re-derived from the Aozora index on each run rather than
 * trusted from the selection file: modern orthography, the expired work
 * copyright flag, and every contributor on the card dead in 1945 or earlier,
 * which is what makes the work public domain in the United States as well as
 * in Japan. checkWork returns the problems it found, never a boolean, so the
 * refusal can say which test failed and for whom.
 *
 * The Japanese verdict in the block is Aozora's own. The US verdict is this
 * repository's computation from the death dates in Aozora's index, and the
 * block says so in those words.
 */
import { INDEX } from './reading-aozora.mjs';

export const TOOL = 'tools/build-reading.mjs';
export const GENERATED_AT = '2026-09-08';

export function deathYear(value) {
  const m = String(value || '').match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

export function checkWork(sel, rows, filters) {
  const problems = [];
  const work = rows[0];
  if (work.orthography !== filters.orthography) {
    problems.push(`orthography is ${work.orthography || 'absent'}, the selection admits only ${filters.orthography}`);
  }
  if (work.copyright !== filters.copyright_flag) {
    problems.push(`work copyright flag is ${work.copyright || 'absent'}, the selection admits only ${filters.copyright_flag}`);
  }
  for (const row of rows) {
    const year = deathYear(row.death);
    const who = `${row.familyName}${row.givenName} (${row.role || 'no role'})`;
    if (year === null) problems.push(`${who} has no death date on the card, so the US test cannot be applied`);
    else if (year > filters.death_year_at_or_before) {
      problems.push(`${who} died ${year}, after ${filters.death_year_at_or_before}`);
    }
  }
  if (sel.title && work.title !== sel.title) {
    problems.push(`the card is titled ${work.title}, the selection says ${sel.title}`);
  }
  return problems;
}

export function licenceFor(sel, rows, work, source) {
  const people = rows.map((r) => `${r.familyName}${r.givenName} d.${deathYear(r.death)}`);
  return {
    source: `Aozora Bunko card ${sel.card}, ${work.title}`,
    url: work.card,
    spdx: 'public-domain',
    derived: true,
    id: null,
    acknowledgement: null,
    links: [work.card, work.textUrl, 'https://www.aozora.gr.jp/guide/kijyunn.html'],
    screen: 'none',
    card: sel.card,
    japan: {
      pd: true,
      basis: `${people.join(', ')}, and Aozora's own work copyright flag on the card reads expired`,
      test: 'Japan: every contributor died 1967 or earlier, or the work is anonymous and published 1967 or earlier. Aozora publishes its own determination per card and this file carries it.',
      confidence: 'high',
    },
    us: {
      pd: true,
      basis: `every contributor died 1945 or earlier (${people.join(', ')}), so the work was already out of copyright in Japan on 1996-01-01 and the URAA restored nothing`,
      test: 'US: published 1930 or earlier, or published later with every author dead in 1945 or earlier, because the URAA restored anything still protected in its source country on 1996-01-01.',
      confidence: 'high',
      note: "The Japanese verdict is Aozora's. The US verdict is this repository's computation from the contributor death dates in Aozora's own index, per docs/delivery/research/japanese-chapters-9-12-and-piano.md section A8.",
    },
    source_edition: {
      name: work.edition,
      publisher: work.editionPublisher,
      first_printing: work.editionYear,
      note: 'Aozora asks, and does not require, that its metadata block travel with a copy. It is kept here rather than dropped.',
    },
    upstream: {
      index: `${INDEX.name}, ${source.index.bytes} bytes, sha256 ${source.index.sha256}`,
      text: `${work.textUrl}, ${source.text.bytes} bytes, sha256 ${source.text.sha256}, ${work.textEncoding}`,
      fetched: GENERATED_AT,
    },
    read_by: sel.read_by,
    generated_by: TOOL,
    generated_at: GENERATED_AT,
  };
}
