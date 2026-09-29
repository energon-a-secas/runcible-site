// Hash routing. Six routes, no library, no history rewriting.
//
// A hash keeps every deep link static-host friendly: GitHub Pages serves
// index.html and the fragment never reaches the server, so a reload of
// #/b/japanese/1-hiragana works without a rewrite rule.
//
// A Book's tool has its own top-level prefix, #/tool/<book>/<tool>, rather
// than a segment under #/b/, because everything after the Book id there is a
// chapter id and chapter ids have no reserved words. Only ids travel in the
// hash: text a tool reads never does.

/** Route names, and the hash each one builds. */
export const ROUTES = {
  today: () => '#/',
  catalog: () => '#/books',
  book: (p) => `#/b/${encodeURIComponent(p.bookId)}`,
  chapter: (p) => `#/b/${encodeURIComponent(p.bookId)}/${encodeURIComponent(p.chapterId)}`,
  tool: (p) => `#/tool/${encodeURIComponent(p.bookId)}/${encodeURIComponent(p.toolId)}`,
  settings: () => '#/settings',
};

/** Build a hash for a named route. */
export function href(name, params = {}) {
  const build = ROUTES[name];
  if (!build) throw new Error('unknown route: ' + name);
  return build(params);
}

/**
 * Parse a hash into { name, params }. An unknown shape is the catalog, because
 * a stale bookmark should land somewhere real rather than on an error screen.
 */
export function parse(hash = location.hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { name: 'today', params: {} };
  if (parts[0] === 'books') return { name: 'catalog', params: {} };
  if (parts[0] === 'settings') return { name: 'settings', params: {} };
  if (parts[0] === 'b' && parts[1] && parts[2]) {
    return { name: 'chapter', params: { bookId: parts[1], chapterId: parts.slice(2).join('/') } };
  }
  if (parts[0] === 'b' && parts[1]) return { name: 'book', params: { bookId: parts[1] } };
  // With no tool id the view opens the Book's first tool; a tool id it does
  // not know is an error naming book.json, never a silent fallback.
  if (parts[0] === 'tool' && parts[1]) {
    return { name: 'tool', params: { bookId: parts[1], toolId: parts.slice(2).join('/') || null } };
  }
  return { name: 'catalog', params: {} };
}

/** Navigate. Setting the hash fires hashchange, which is the single entry point. */
export function go(name, params) {
  const next = href(name, params);
  if (location.hash === next) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = next;
}

/** Start listening. Calls back once immediately with the current route. */
export function start(onRoute) {
  const fire = () => onRoute(parse());
  window.addEventListener('hashchange', fire);
  fire();
  return () => window.removeEventListener('hashchange', fire);
}
