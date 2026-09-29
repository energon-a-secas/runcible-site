// The table of contents: the rail, the page bar, and the bookmark.
//
// One nav, one markup. From 1180px the CSS shows it as a 220px sticky rail
// beside the prose; below that it is a 40px page bar under the header whose
// disclosure pushes the page down (not a modal, not a drawer). The bookmark is
// a state, not a motion: an accent ribbon hangs from the rail's top edge into
// the current rung's line, where the learner stopped.

import { t, ui } from './i18n.js';
import { h } from './utils.js';
import { href } from './router.js';
import { stateGlyph, textAction, titleOf, chapterPosition, evidenceSentence } from './render-shared.js';

/**
 * @param {{ book, rows, chapterId, rungs: Array, current: object|null }} o
 *   rows are progress.ladder() rows; rungs are the open chapter's rungs
 *   (empty for a locked or planned one); current is the bookmarked rung.
 */
export function railNode({ book, rows, chapterId, rungs, current }) {
  const row = rows.find((r) => r.id === chapterId);
  const pos = chapterPosition(book, chapterId);
  const rungAt = current ? rungs.findIndex((r) => r.id === current.id) + 1 : 0;

  const bar = h('button', {
    class: 'rn-rail-bar',
    type: 'button',
    'data-action': 'toggle-contents',
    'aria-expanded': 'false',
    'aria-controls': 'rn-contents',
  }, [
    h('span', { class: 'rn-rail-bar-label' }, ui('contents')),
    h('span', { class: 'rn-rail-crumb' }, [
      h('span', { class: 'rn-crumb-ch' }, row ? titleOf(row) : chapterId),
      current ? h('span', { class: 'rn-crumb-sep', 'aria-hidden': 'true' }, '·') : null,
      current ? h('span', { class: 'rn-crumb-rung' }, t(current.title)) : null,
    ]),
    rungAt ? h('span', { class: 'rn-rail-pos' }, ui('pageOf', { at: rungAt, total: rungs.length })) : null,
  ]);

  const body = h('div', { class: 'rn-rail-body', id: 'rn-contents' }, [
    h('p', { class: 'rn-rail-head' }, ui('chapterOf', pos)),
    h('ol', { class: 'rn-toc' }, rows.map((r) => tocRow(book, r, r.id === chapterId ? { rungs, current } : null))),
  ]);

  return h('nav', { class: 'rn-rail', 'aria-label': ui('contents') }, [bar, body]);
}

/** One chapter as a line: glyph, title, and for the open chapter its rungs. */
function tocRow(book, row, open) {
  const glyph = stateGlyph(row.state);
  const attrs = { class: 'rn-toc-ch', 'data-state': row.state };
  if (open) attrs['aria-current'] = 'page';
  const ev = evidenceSentence(row.evidence) || null;
  const to = href('chapter', { bookId: book.id, chapterId: row.id });
  const parts = [];
  if (row.state === 'available' || row.state === 'passed') {
    parts.push(h('a', { class: 'rn-toc-line', href: to, title: ev }, [glyph, h('span', { class: 'rn-toc-title' }, titleOf(row))]));
  } else if (row.state === 'locked') {
    // A locked chapter opens read-only, so its title is a link like any other.
    // C3.4: it also carries its override, as a small text link rather than a
    // 36px button repeated down the rail, and on the chapter's own line rather
    // than a second one: thirteen chapters spending two rows each is what
    // pushed the rail past the height of its sticky box. The two are siblings,
    // because a button inside a link is not a thing a page may hold.
    const override = textAction(ui('openAnywayWord'), 'override-on', { chapter: row.id }, 'rn-textlink rn-toc-override');
    override.setAttribute('aria-label', `${ui('openAnywayShort')}: ${titleOf(row)}`);
    parts.push(h('span', { class: 'rn-toc-line' }, [
      glyph,
      h('a', { class: 'rn-toc-title', href: to, title: ev }, titleOf(row)),
      h('span', { class: 'rn-toc-sep', 'aria-hidden': 'true' }, '\u00b7'),
      override,
    ]));
  } else {
    parts.push(h('span', { class: 'rn-toc-line', title: ev }, [glyph, h('span', { class: 'rn-toc-title' }, titleOf(row))]));
  }
  if (open && open.rungs.length) {
    parts.push(h('ol', { class: 'rn-toc-rungs' },
      open.rungs.map((rung) => rungRow(book, row.id, rung, !!(open.current && open.current.id === rung.id)))));
  }
  return h('li', attrs, parts);
}

function rungRow(book, chapterId, rung, isCurrent) {
  return h('li', { class: isCurrent ? 'rn-toc-rung rn-toc-rung--current' : 'rn-toc-rung' }, [
    isCurrent ? h('span', { class: 'rn-bookmark', 'aria-hidden': 'true' }) : null,
    h('a', {
      class: 'rn-toc-rung-link',
      href: href('chapter', { bookId: book.id, chapterId }),
      'data-action': 'scroll-to',
      'data-target': `rung-${rung.id}`,
      'aria-current': isCurrent ? 'location' : null,
    }, t(rung.title)),
  ]);
}
