// Settings: language, track, reset, and the Book's registered modules.

import { state } from './state.js';
import { ui } from './i18n.js';
import { h } from './utils.js';
import * as books from './books.js';
import { action } from './render-shared.js';
import { trackPicker } from './render-contents.js';

function segmented(items, isOn, act, key, label) {
  const buttons = items.map(([val, text]) => {
    const b = action(text, act, { [key]: val }, 'rn-seg-btn');
    b.setAttribute('aria-pressed', String(isOn(val)));
    return b;
  });
  return h('div', { class: 'rn-seg', role: 'group', 'aria-label': label }, buttons);
}

function setting(title, body) {
  return h('section', { class: 'rn-setting' }, [h('h3', { class: 'rn-setting-title' }, title), body]);
}

export async function settingsView() {
  // state.book is set by whichever Book route last ran, so a deep link straight
  // to #/settings found it null: Track and Reset vanished and the module
  // readout said "none" for a Book that registers six. The chosen Book is in
  // prefs, which survives a reload, so open it.
  let book = state.book;
  if (!book && state.prefs.bookId) {
    try { book = await books.openBook(state.prefs.bookId); } catch { book = null; }
  }
  const rows = [
    h('h2', { class: 'rn-title' }, ui('settings')),
    setting(ui('language'), segmented(
      [['en', 'English'], ['es', 'Español']], (v) => state.prefs.lang === v, 'set-lang', 'lang', ui('language'),
    )),
  ];
  if (book) {
    rows.push(setting(ui('track'), trackPicker(book) || h('p', { class: 'rn-lead' }, ui('oneTrack'))));
    rows.push(setting(ui('reset'), h('div', { class: 'toolbar' },
      action(ui('reset'), 'reset-book', { book: book.id }, 'btn btn--danger btn--sm'))));
  }
  // Modules are registered by whichever Book is open, so with no Book this row
  // is a readout of nothing: "exercises: none · transforms: none" is a report
  // that the shell is empty rather than that the visitor has not chosen yet.
  const ids = books.registeredIds();
  const list = (xs) => (xs.length ? xs.join(', ') : ui('none'));
  rows.push(setting(ui('bookModules'), h('p', { class: 'rn-lead' }, book
    ? `${ui('modExercises')}: ${list(ids.exercises)} · ${ui('modTransforms')}: ${list(ids.transforms)}`
    : ui('chooseBookFirst'))));
  return rows;
}
