/**
 * Quiz sets, the beats game: how many beats a katakana loanword has, built
 * from data/loanwords (seed.json, with rules.json behind the explain lines).
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. See tools/build-sets.mjs.
 *
 * Nothing here supplies Japanese or English of its own. The split is
 * mechanical from the katakana; the rule pointer and the explain line come
 * from the corpus, and where it has neither the item carries null. The romaji
 * is the corpus's own line when it has one and otherwise read off the kana
 * through the tables, macron style either way and never null.
 */
import { LICENCES, licenceBlock } from './corpus.mjs';
import { TOOL, bilingual, readData, skip } from './sets-common.mjs';
import { hepburn, idRomaji, moraSplit, romajiMap } from './sets-kana.mjs';

export function beatsSet(spec) {
  const seed = readData(spec.from);
  const rulesDoc = spec.rules ? readData(spec.rules) : null;
  const rules = new Map((rulesDoc?.rules || []).map((r) => [r.id, r]));
  const kata = romajiMap(readData('kana/katakana.json'));
  const items = [];
  const seen = new Set();
  let fromWord = 0;
  let fromRule = 0;

  // The teacher panel is adding explain lines to rules.json and to seed words,
  // and rule pointers to seed words. Read whatever is there. The pointer: a
  // singular `rule` wins, then the first of the word's `rules`, then the
  // verified table's `en_source`, then nothing. The explain line: the word's
  // own wins, because it says why THIS word has these beats; then its rule's
  // line, which is about the rule; then null, never a line of our own.
  const pointer = (entry) => {
    if (typeof entry.rule === 'string' && entry.rule) return entry.rule;
    if (Array.isArray(entry.rules) && entry.rules.length) return entry.rules[0];
    if (typeof entry.en_source === 'string' && entry.en_source) return entry.en_source;
    return null;
  };
  const explainFor = (entry, ruleId) => {
    const own = bilingual(entry.explain);
    if (own) { fromWord += 1; return own; }
    const r = ruleId && rules.get(ruleId);
    const line = r ? bilingual(r.explain) : null;
    if (line) fromRule += 1;
    return line;
  };

  // The contract: the corpus's own line when it has one, else the kana read
  // through the tables, macron style either way, never null. The derived line
  // is checked against every corpus line we do have, so the fallback is not a
  // path nobody has ever run.
  let derived = 0;
  let agreed = 0;
  const disagree = [];
  const romajiFor = (kana, corpus) => {
    if (!corpus) { derived += 1; return hepburn(kana, kata); }
    let ours = null;
    try { ours = hepburn(kana, kata); } catch (e) { ours = `unreadable: ${e.message}`; }
    if (ours === corpus) agreed += 1;
    else disagree.push(`${kana} corpus ${corpus}, tables ${ours}`);
    return corpus;
  };

  const push = (entry, corpusRomaji, source) => {
    const kana = entry.katakana;
    const word = entry.en;
    if (!word) return skip(spec.id, `${kana}: the corpus gives no English word to show under it (${source})`);
    const romaji = romajiFor(kana, corpusRomaji);
    const split = Array.isArray(entry.split) ? entry.split : moraSplit(kana);
    if (split.join('') !== kana) return skip(spec.id, `${kana}: split does not rejoin to the kana`);
    if (split.length > 9) return skip(spec.id, `${kana} (${word}) has ${split.length} beats and the game's options stop at 9`);
    const id = `lw-${idRomaji(kana, kata)}`;
    if (seen.has(id)) return skip(spec.id, `${kana}: id ${id} collides with an earlier word`);
    seen.add(id);
    const rule = pointer(entry);
    const explain = explainFor(entry, rule);
    items.push({ id, word, kana, romaji, beats: split.length, split, rule, explain });
    return undefined;
  };

  for (const entry of seed.entries) push(entry, entry.romaji, 'entries');

  // The strings the report verified after its table. One that has an English
  // word carries its own romaji, rules and explain line (the teacher panel
  // fills the four together); one with only en_source is the older shape, and
  // then the rule row's example is the sourced romaji. No English word, no item.
  if (spec.include_verified) {
    const noWord = [];
    for (const v of seed.verified?.entries || []) {
      if (!v.en) { noWord.push(v.katakana); continue; }
      let romaji = typeof v.romaji === 'string' && v.romaji ? v.romaji : null;
      if (!romaji && v.en_source) {
        const ex = rules.get(v.en_source)?.examples?.find((e) => Array.isArray(e.katakana) && e.katakana.includes(v.katakana));
        romaji = ex?.romaji || null;
      }
      push(v, romaji, `verified, rule ${pointer(v) || 'none'}`);
    }
    if (noWord.length) skip(spec.id, `${noWord.length} verified strings with no English word in the corpus (${noWord.join(' ')})`);
  }

  const edrdg = LICENCES.edrdg;
  let attribution = edrdg.acknowledgement;
  const extra = {
    note: 'Derived from data/loanwords/seed.json, which the corpus treats as JMdict-derived, so the set inherits EDRDG share-alike terms and the per-screen acknowledgement. The beat split is mechanical from the katakana. rule is the corpus pointer; explain is the word\'s own line from seed.json when it has one, else that rule\'s line from rules.json; null means the corpus has neither yet.',
  };
  if (fromRule && rulesDoc?._licence?.acknowledgement) {
    // A rule-level explain line is rules.json prose, which carries its own
    // credit. A word-level line lives in seed.json and is covered by its block.
    attribution = `${attribution} ${rulesDoc._licence.acknowledgement}`;
    extra.also = rulesDoc._licence.acknowledgement;
  }
  return {
    lang: 'ja',
    licence: { spdx: edrdg.spdx, screen: 'required', attribution, source: edrdg.url },
    _licence: licenceBlock('edrdg', TOOL, extra),
    items,
    summary: `${items.length} words: ${fromWord} explained by the word's own line, ${fromRule} by the rule's, ${items.length - fromWord - fromRule} with none`
      + `; romaji ${items.length - derived} from the corpus (the tables re-read ${agreed} of them the same way), ${derived} read off the kana`,
    notes: disagree.length
      ? [`${disagree.length} corpus romaji lines the kana tables read differently (the corpus line ships): ${disagree.join('; ')}`]
      : [],
  };
}
