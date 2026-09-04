// ── custom ───────────────────────────────────────────────────
// C2.1: a Book supplied module. The module decides whether it grades.
// Required spec field: module. Optional: props.
//
// C2.2: the module receives (host, spec, api) and owns the host element
// entirely, so this type adds no chrome of its own. It looks the id up in the
// registry and gets out of the way. The registry has already refused any id
// that could shadow a generic type, so nothing here has to re-check that.

import { ExerciseError } from '../errors.js';

/**
 * @param {object} deps { impl } the registered implementation
 */
export function mountWith(impl, host, spec, api, ctx) {
  if (!impl || typeof impl.mount !== 'function') {
    throw new ExerciseError(
      `the module "${spec.module}" registered an implementation with no mount(host, spec, api)`, ctx, spec);
  }
  const handle = impl.mount(host, spec, api);
  if (handle && typeof handle.destroy === 'function') return handle;
  return { destroy() {} };
}
