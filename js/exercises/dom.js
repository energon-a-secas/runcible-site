// ── DOM builders ─────────────────────────────────────────────
// Nothing in this directory ever assigns innerHTML. C3.3 says chapter content
// carries no inline HTML and "everything is escaped"; textContent is stronger
// than escaping because it cannot be talked out of being text, and it removes
// the question of whether a given call site remembered to escape.
//
// These helpers are local on purpose. The DOM kit (js/neorgon-dom.js) is not
// vendored into this project, and vendoring it is a sync-dom.sh run owned by
// release, not a hand copy. Nothing below duplicates a kit function: escHtml is
// not needed when no string reaches the page as markup.

const DIRECT_PROPS = new Set(['value', 'checked', 'disabled', 'selected']);

/**
 * Build an element.
 * @param {string} tag
 * @param {object} [props] `class`, `text`, `dataset`, anything else is an attribute
 * @param {Array|Node|string} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props, children) {
  const node = document.createElement(tag);
  const p = props || {};
  for (const key of Object.keys(p)) {
    const v = p[key];
    if (v === null || v === undefined || v === false) continue;
    if (key === 'class') node.className = v;
    else if (key === 'text') node.textContent = String(v);
    else if (key === 'dataset') Object.assign(node.dataset, v);
    else if (DIRECT_PROPS.has(key)) node[key] = v;
    else node.setAttribute(key, v === true ? '' : String(v));
  }
  if (children !== undefined) append(node, children);
  return node;
}

/** Append a node, a string, or a nested array of either. Null entries are skipped. */
export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(parent, c);
    else if (typeof c === 'string' || typeof c === 'number') {
      parent.appendChild(document.createTextNode(String(c)));
    } else parent.appendChild(c);
  }
  return parent;
}

/**
 * A button with its listener attached here. There is no inline onclick anywhere
 * in this engine and there is no path that could add one: the handler is an
 * argument, not a string.
 */
export function button(label, onClick, props) {
  const node = el('button', Object.assign({ type: 'button', class: 'btn' }, props || {}), []);
  if (typeof label === 'string') node.textContent = label;
  else if (label) append(node, label);
  if (typeof onClick === 'function') node.addEventListener('click', onClick);
  return node;
}

/** Remove every child. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Focus without scrolling the page under the learner. */
export function focus(node) {
  if (!node || typeof node.focus !== 'function') return;
  try { node.focus({ preventScroll: false }); } catch { node.focus(); }
}

/** Collect an owned listener so destroy() can take it back off. */
export function listeners() {
  const bound = [];
  return {
    on(target, type, fn, opts) {
      if (!target) return;
      target.addEventListener(type, fn, opts);
      bound.push([target, type, fn, opts]);
    },
    off() {
      for (const [target, type, fn, opts] of bound) target.removeEventListener(type, fn, opts);
      bound.length = 0;
    },
  };
}
