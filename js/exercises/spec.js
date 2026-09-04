// ── Spec checking ────────────────────────────────────────────
// The C2.1 table as data, plus the checks that can be made without a browser.
// A1a's tools/validate-book.mjs imports validateExerciseSpec from index.js so
// that a chapter with a missing field fails at the command line rather than at
// the moment a learner opens it. Nothing in this file touches the DOM.

/** The nine, in the order C2.1 lists them. */
export const GENERIC_TYPES = Object.freeze([
  'read', 'choice', 'typed', 'match', 'order', 'listen', 'speak', 'deck', 'custom',
]);

/** C2.1, "Required spec fields", verbatim. */
export const REQUIRED_FIELDS = Object.freeze({
  read: ['pages'],
  choice: ['items', 'prompt', 'answer', 'distractors'],
  typed: ['items', 'prompt', 'answer'],
  match: ['items', 'left', 'right', 'n'],
  order: ['items', 'sequence'],
  listen: ['items', 'speak', 'answer', 'respond'],
  speak: ['items', 'expect'],
  deck: ['src'],
  custom: ['module'],
});

/** Which types can never report true or false, whatever the learner does. */
export const NEVER_GRADED = Object.freeze(['read', 'speak']);

function present(spec, field) {
  const v = spec[field];
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Check one exercise spec.
 * @param {object} spec
 * @param {{ transforms?: string[], modules?: string[] }} [known] ids the Book registered
 * @returns {string[]} problems, empty when the spec is usable
 */
export function validateExerciseSpec(spec, known) {
  const k = known || {};
  const out = [];
  if (!spec || typeof spec !== 'object') return ['exercise is not an object'];

  if (!spec.id) out.push('missing "id"');
  const type = spec.type;
  if (!type) out.push('missing "type"');
  else if (!GENERIC_TYPES.includes(type)) {
    out.push(`"type": "${type}" is not one of the nine generic types (${GENERIC_TYPES.join(', ')}). ` +
      'A Book module is used as { "type": "custom", "module": "<id>" }');
  }
  if (!spec.skill) out.push('missing "skill". C2.3 makes it a required part of every attempt');

  if (type && REQUIRED_FIELDS[type]) {
    for (const field of REQUIRED_FIELDS[type]) {
      if (!present(spec, field)) out.push(`"${type}" needs "${field}"`);
    }
  }

  if (type === 'listen' && spec.respond && !['choice', 'typed'].includes(spec.respond)) {
    out.push(`"respond": "${spec.respond}" must be "choice" or "typed"`);
  }
  if (type === 'choice' && spec.distractors && typeof spec.distractors !== 'object') {
    out.push('"distractors" must be an object, for example { "from": "siblings", "n": 3 }');
  }
  if (type === 'match' && spec.n !== undefined && !Number.isFinite(spec.n)) {
    out.push('"n" must be a number');
  }
  if (spec.count !== undefined && !Number.isFinite(spec.count)) {
    out.push('"count" must be a number');
  }
  if (spec.pass !== undefined) {
    if (typeof spec.pass !== 'object' || !Number.isFinite(spec.pass.accuracy)) {
      out.push('"pass" must be an object with a numeric "accuracy"');
    }
  }

  if (spec.transform !== undefined) {
    if (typeof spec.transform !== 'string' || spec.transform === '') {
      out.push('"transform" must be a registered transform id');
    } else if (Array.isArray(k.transforms) && !k.transforms.includes(spec.transform)) {
      out.push(`"transform": "${spec.transform}" is not registered by this Book. ` +
        'The shell ships no transforms (C2.4)');
    }
  }
  if (type === 'custom' && spec.module && Array.isArray(k.modules) && !k.modules.includes(spec.module)) {
    out.push(`"module": "${spec.module}" is not registered by this Book`);
  }

  if (NEVER_GRADED.includes(type) && spec.pass) {
    out.push(`"${type}" records correct: null always (C2.1), so a "pass" threshold can never be met`);
  }

  return out;
}

/**
 * The id rules from C2.2, for an **exercise** id: it must contain a dot and
 * must not start with a generic type name.
 *
 * "Start with" is read as the first dot separated segment, not a raw prefix
 * match: the point of the rule is that a Book cannot shadow `typed`, and a raw
 * prefix would also refuse `reading.aloud` for beginning with `read`.
 *
 * C12 A10: this is an exercise id rule and always was. A transform id goes
 * through checkTransformId below.
 *
 * @returns {string|null} the problem, or null when the id is fine
 */
export function checkRegisteredId(id) {
  if (typeof id !== 'string' || id === '') return 'a registered id must be a non-empty string';
  if (!id.includes('.')) return `"${id}" must contain a dot, for example "jp.loanword"`;
  const head = id.split('.')[0];
  if (GENERIC_TYPES.includes(head)) {
    return `"${id}" starts with the generic type name "${head}", which a Book may not shadow`;
  }
  return null;
}

/**
 * The id rule for a transform id, which is only that there is one.
 *
 * C12 A10 (2026-09-04): the dot rule above is an exercise id rule. Its stated
 * purpose in C2.2 is that "a Book cannot shadow `typed`", a namespace concern
 * for the nine generic types, and C2.4 says the shell ships no transforms, so a
 * transform id has no generic namespace to shadow. Requiring a dot there
 * protected nothing and refused C1.2's own worked example,
 * `"transforms": ["kana", "kana-katakana"]`. Transform ids are free-form.
 *
 * @returns {string|null} the problem, or null when the id is fine
 */
export function checkTransformId(id) {
  if (typeof id !== 'string' || id === '') {
    return 'with no usable id: a transform id must be a non-empty string';
  }
  return null;
}
