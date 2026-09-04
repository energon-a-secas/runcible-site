// Shared helpers for this Book's own exercise modules.
//
// A Book module owns its host element entirely (C2.2) and receives only the
// frozen api, so it cannot reach the engine's DOM helpers. Rather than repeat
// element building in five files, they share this one. It registers nothing and
// the shell never imports it: it is an implementation detail of the modules
// listed in modules[].
//
// Nothing here ever assigns innerHTML, and no listener is ever an attribute.
// C3.3 forbids inline HTML in content and PLAN constraint 2 forbids inline
// onclick anywhere, so the safe path is the only path on offer.

const DIRECT = new Set(['value', 'checked', 'disabled', 'hidden']);

/** Build an element. `text` sets textContent, everything else is an attribute. */
export function el(tag, props, children) {
  const node = document.createElement(tag);
  const p = props || {};
  for (const key of Object.keys(p)) {
    const v = p[key];
    if (v === null || v === undefined || v === false) continue;
    if (key === 'class') node.className = v;
    else if (key === 'text') node.textContent = String(v);
    else if (key === 'dataset') Object.assign(node.dataset, v);
    else if (DIRECT.has(key)) node[key] = v;
    else node.setAttribute(key, v === true ? '' : String(v));
  }
  if (children !== undefined) add(node, children);
  return node;
}

/** Append a node, a string, or a nested array of either. Nulls are skipped. */
export function add(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) add(parent, c);
    else if (typeof c === 'string' || typeof c === 'number') parent.appendChild(document.createTextNode(String(c)));
    else parent.appendChild(c);
  }
  return parent;
}

/** Remove every child. */
export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** A button whose handler is an argument, never a string in an attribute. */
export function button(label, onClick, cls = 'btn btn--secondary btn--sm', props) {
  const node = el('button', Object.assign({ type: 'button', class: cls, text: label }, props || {}));
  if (typeof onClick === 'function') node.addEventListener('click', onClick);
  return node;
}

/** Collect owned listeners so destroy() can take every one of them back off. */
export function listeners() {
  const bound = [];
  return {
    on(target, type, fn, opts) {
      if (!target) return;
      target.addEventListener(type, fn, opts);
      bound.push([target, type, fn, opts]);
    },
    off() {
      for (const [t, type, fn, opts] of bound) t.removeEventListener(type, fn, opts);
      bound.length = 0;
    },
  };
}

/** Fisher-Yates on a copy. */
export function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}

/**
 * Choose the items for one run. With no count every item is asked, which is
 * honest: a silent default would quietly drop most of a 40 word list.
 */
export function pick(items, count) {
  if (!Number.isFinite(count) || count <= 0 || count >= items.length) return shuffle(items);
  return shuffle(items).slice(0, Math.floor(count));
}

/**
 * Resolve a spec field that is either a C3.2 pointer or an inline array.
 * The Book never parses a pointer: C3.2 puts that resolver in the shell and
 * api.data takes the whole string.
 */
export async function resolveList(api, source, field) {
  if (Array.isArray(source)) return source;
  if (typeof source === 'string' && source) {
    const got = await api.data(source);
    if (Array.isArray(got)) return got;
    if (got && typeof got === 'object') return Object.values(got);
    throw new Error(`"${field}" resolved "${source}" to something that is not a list`);
  }
  throw new Error(`"${field}" must be a data pointer string or an array`);
}

/**
 * The frame every module in this Book draws into: a title, a live progress
 * line, a body, and a footer the module fills.
 */
export function frame(host, { title, lead, cls = '' }) {
  clear(host);
  const status = el('p', { class: 'jp-status', role: 'status', 'aria-live': 'polite' });
  const body = el('div', { class: 'jp-body' });
  const foot = el('div', { class: 'toolbar jp-foot' });
  const root = el('section', { class: `jp ${cls}`.trim() }, [
    title ? el('h4', { class: 'jp-title', text: title }) : null,
    lead ? el('p', { class: 'jp-lead', text: lead }) : null,
    status,
    body,
    foot,
  ]);
  host.appendChild(root);
  return { root, status, body, foot };
}

/**
 * The end panel. It is a button rather than an automatic exit, so the learner
 * reads the result before the page moves: api.done() is called from Continue,
 * not from the moment the last item is answered.
 */
export function summary(view, api, { asked, right, graded = true, note = null }) {
  clear(view.body);
  clear(view.foot);
  const line = graded
    ? `${right} of ${asked} correct.`
    : `${asked} done. Nothing here was graded, so nothing was scored.`;
  view.status.textContent = '';
  add(view.body, [
    el('p', { class: 'jp-score', text: line }),
    note ? el('p', { class: 'jp-note', text: note }) : null,
  ]);
  const go = button('Continue', () => api.done({ asked, right, graded }), 'btn btn--primary');
  view.foot.appendChild(go);
  go.focus();
}
