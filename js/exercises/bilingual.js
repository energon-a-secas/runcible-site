// ── List valued bilingual content ────────────────────────────
// C's convention 2 gives {en,es} its semantics: a bare string is legal, English
// is the fallback, then Spanish, then empty.
//
// api.t handles a scalar. It cannot handle a C3.3 prose body, which is
// { en: [paragraph, paragraph], es: [...] }: passing that to a resolver that
// returns a string gives back "one,two". C2.3 freezes api to exactly six
// members and none of them resolves a list, so this is the one piece of the
// bilingual contract an exercise has to do for itself. It is eight lines and it
// is the same fallback order as everything else in the fleet, which is the only
// thing that matters about it.
//
// Named as a gap for delivery-lead rather than hidden: if C2.3 grows a tList
// member, this file goes away and read.js calls that instead.

/**
 * @param {*} value a bare string, an array, or { en: [], es: [] }
 * @param {string} lang the current UI language, api.lang
 * @returns {string[]}
 */
export function paragraphs(value, lang) {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return value === '' ? [] : [value];
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v : String(v)));
  if (typeof value !== 'object') return [String(value)];
  const own = value[lang];
  if (Array.isArray(own) && own.length) return own.map(String);
  if (typeof own === 'string' && own) return [own];
  if (Array.isArray(value.en) && value.en.length) return value.en.map(String);
  if (typeof value.en === 'string' && value.en) return [value.en];
  if (Array.isArray(value.es) && value.es.length) return value.es.map(String);
  if (typeof value.es === 'string' && value.es) return [value.es];
  return [];
}
