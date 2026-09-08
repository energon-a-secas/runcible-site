/**
 * A content page's `links[]` (C3.3): the one place a chapter draws an anchor.
 *
 *   "links": [{ "href": "https://...", "label": { "en": "", "es": "" },
 *               "note": { "en": "", "es": "" } }]
 *
 * Two rules carry the weight. **https only**, because a chapter file is
 * authored by a skill and an href is the one content field that is not text: a
 * scheme the renderer would hand to the browser has to be settled at build
 * time, not argued about per link. And **a label is required**, because the
 * renderer falls back to showing the URL, and a wall of raw URLs is what the
 * callout bodies already were. The renderer (js/render-pages.js linksNode)
 * enforces the same https rule at paint time, so a hand-edited file cannot
 * walk past this one.
 *
 * `note` is optional and rides after the anchor, for the line that says what
 * the reader will find there.
 *
 * Lives here rather than in validate-book.mjs so that file stays under the
 * fleet's 500-line rule, the same reason deck-skills.mjs is a file.
 *
 * @param {{err: function, warn: function}} r the validator's report
 * @param {string} at the path of the links array, for the message
 * @param {*} links the page's links field
 * @param {function} checkBilingual validate-book's own { en, es } check, so
 *   there is one notion of a bilingual value and one HTML refusal
 */
export function checkPageLinks(r, at, links, checkBilingual) {
  if (!Array.isArray(links)) {
    r.err(at, 'must be an array of { href, label, note } objects');
    return;
  }
  if (links.length === 0) r.warn(at, 'is empty, so it draws nothing: leave it out instead');
  const seen = new Set();
  links.forEach((link, i) => {
    const path = `${at}[${i}]`;
    if (link === null || typeof link !== 'object' || Array.isArray(link)) {
      r.err(path, 'must be an object with an href and a label');
      return;
    }
    const href = link.href;
    if (typeof href !== 'string' || href === '') r.err(`${path}.href`, 'is required');
    else if (!/^https:\/\/[^\s"'<>]+$/.test(href)) {
      r.err(`${path}.href`, 'must be an https URL: the page renderer refuses every other scheme');
    } else if (seen.has(href)) r.warn(`${path}.href`, `is a duplicate of an earlier link on this page: ${href}`);
    else seen.add(href);
    checkBilingual(r, `${path}.label`, link.label);
    if (link.note !== undefined) checkBilingual(r, `${path}.note`, link.note, { required: false });
  });
}
