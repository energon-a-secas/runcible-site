// Shared utilities: small, pure-ish helpers used across modules.
//
// Speech is deliberately not here. The exercise engine owns one speech path
// with one voiceschanged listener (js/exercises/speech.js), and api.tts is that
// function, so a second implementation in this file would be a second listener.
//
// The DOM builder h() exists for one reason: chapter content is authored by a
// skill and by hand, and C3.3 says no content field may carry inline HTML.
// Building with createElement plus textContent makes that structural instead of
// something a reviewer has to notice. Nothing in this shell writes innerHTML,
// so there is no escHtml here either: a helper for the unsafe path invites the
// unsafe path.

/**
 * Build an element.
 *   h('p', 'text')
 *   h('div', { class: 'card' }, [child, 'text'])
 * Attribute keys starting with "on" are refused: listeners belong in events.js.
 */
export function h(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs && (typeof attrs === 'string' || attrs instanceof Node || Array.isArray(attrs))) {
    children = attrs;
    attrs = null;
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (/^on/i.test(k)) throw new Error('h(): inline handlers are not allowed, wire it in events.js');
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

/** Append a child, an array of children, or a string, to a node. */
export function append(el, children) {
  if (children === null || children === undefined || children === false) return el;
  if (Array.isArray(children)) {
    for (const c of children) append(el, c);
    return el;
  }
  el.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
  return el;
}

/** Remove every child of a node. */
export function clear(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Show a temporary toast notification. */
let _toastTimer = null;
export function showToast(msg) {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('visible'), 2400);
}

/** Simple debounce. */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** 0.873 -> "87%". */
export function pct(n) {
  if (!Number.isFinite(n)) return '0%';
  return Math.round(n * 100) + '%';
}
