/**
 * Cross-chapter check: an embedded exercise's `skill` is the name its answers
 * are recorded under (js/embed.js and js/quiz-host.js both record the spec's
 * skill), and evidence is read back by exact string (js/progress.js), so a
 * skill nothing in this Book reads is progress that lands nowhere with no
 * error anywhere. QA found all four decks in that state on 2026-09-04. The
 * intended shape is the chapter's own goal. A skill another chapter measures
 * is allowed and named out loud, because an embed may deliberately feed an
 * earlier goal. Anything else fails.
 *
 * `decks` carries both embed types, deck and quiz; the caller decides which
 * types are subject to the rule.
 *
 * Lives here rather than in validate-book.mjs so that file stays under the
 * fleet's 500-line rule.
 */
export function checkDeckSkills({ goals, emitted, decks, fail, warn }) {
  const known = new Set([...goals.values(), ...emitted]);
  for (const { file, chapterId, ex } of decks) {
    const own = goals.get(chapterId);
    if (!ex.skill) {
      fail(`${file}: ${ex.type} ${ex.id} has no skill, so its answers count toward nothing`);
      continue;
    }
    if (ex.skill === own) continue;
    if (known.has(ex.skill)) warn(`${file}: ${ex.type} ${ex.id} feeds "${ex.skill}", not this chapter's goal "${own}"`);
    else fail(`${file}: ${ex.type} ${ex.id} feeds "${ex.skill}", which no goal or exercise in this Book reads`);
  }
}
