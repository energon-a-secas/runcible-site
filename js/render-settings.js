// Settings: language, motion, track, the voice, reset, and, behind a
// disclosure, the Book's registered modules.

import { state } from './state.js';
import { ui } from './i18n.js';
import { h, append, clear } from './utils.js';
import * as books from './books.js';
import { action } from './render-shared.js';
import { trackPicker } from './render-contents.js';
import { synthAvailable, voicesFor, tts } from './exercises/index.js';

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

function systemReducesMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The pref reduceMotion had no control, so the only way to reduce motion was
 * the operating system's own setting. Both still count: js/render-mount.js
 * reduces when either asks, and this says so rather than offering a Full that
 * would not take effect.
 */
function motionSetting() {
  const on = !!state.prefs.reduceMotion;
  return setting(ui('motion'), h('div', { class: 'rn-tracks' }, [
    segmented([['off', ui('motionFull')], ['on', ui('motionReduced')]],
      (v) => (v === 'on') === on, 'set-motion', 'motion', ui('motion')),
    systemReducesMotion() ? h('p', { class: 'rn-lead' }, ui('motionSystem')) : null,
  ]));
}

/** The content language's own name in the reader's language, else its tag. */
function languageName(tag) {
  try {
    return new Intl.DisplayNames([state.prefs.lang], { type: 'language' }).of(tag) || tag;
  } catch {
    return tag;
  }
}

/**
 * What Test says: the Book's title in its own content language when the title
 * has one, else the Book's glyph. Both are the Book's words, so the shell
 * never has to carry a sentence in a language it does not know.
 */
function voiceSample(book) {
  const content = String((book.lang && book.lang.content) || '');
  const title = book.title && typeof book.title === 'object' ? book.title : {};
  const primary = content.split('-')[0];
  return title[content] || title[primary] || book.glyph || '';
}

/**
 * Say the sample with the chosen voice. Called by events.js for `test-voice`.
 * speak() in the engine falls back to the device's first voice for the
 * language when the chosen one is gone, which is what a drill does too.
 */
export function testVoice() {
  const book = state.book;
  if (!book) return;
  const lang = (book.lang && book.lang.content) || 'en';
  void tts(voiceSample(book), { lang, voiceURI: state.prefs.ttsVoice || undefined });
}

/**
 * Fill the voice setting once the device's list is known. It is async on
 * Chrome (C2.5, js/exercises/speech.js), and a device with no voices at all
 * only answers after a 1.5 s deadline, so the rest of Settings paints first
 * and this body fills in when the list arrives.
 */
async function fillVoices(body, book) {
  const lang = (book.lang && book.lang.content) || 'en';
  const name = languageName(lang);
  if (!synthAvailable()) {
    clear(body);
    body.appendChild(h('p', { class: 'rn-lead' }, ui('voiceNoSynth')));
    return;
  }
  let voices = [];
  try { voices = await voicesFor(lang); } catch { voices = []; }
  clear(body);
  if (!voices.length) {
    body.appendChild(h('p', { class: 'rn-lead' }, ui('voiceNone', { lang: name })));
    return;
  }
  const chosen = state.prefs.ttsVoice;
  const known = !chosen || voices.some((v) => v.voiceURI === chosen);
  const select = h('select', { id: 'rn-voice', class: 'rn-select', 'data-change': 'set-voice' }, [
    h('option', { value: '' }, ui('voiceAuto')),
    ...voices.map((v) => h('option', { value: v.voiceURI }, `${v.name} (${v.lang})`)),
  ]);
  select.value = known && chosen ? chosen : '';
  append(body, [
    h('p', { class: 'rn-lead' }, ui('voiceLead', { lang: name })),
    h('div', { class: 'toolbar rn-voice-row' }, [
      h('label', { class: 'sr-only', for: 'rn-voice' }, ui('voice')),
      select,
      action(ui('voiceTest'), 'test-voice', {}, 'btn btn--secondary btn--sm'),
    ]),
    known ? null : h('p', { class: 'rn-lead rn-voice-gone' }, ui('voiceGone')),
  ]);
}

function voiceSetting(book) {
  const body = h('div', { class: 'rn-tracks rn-voice', 'aria-live': 'polite' },
    h('p', { class: 'rn-lead' }, ui('voiceLoading')));
  void fillVoices(body, book);
  return setting(ui('voice'), body);
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
    motionSetting(),
  ];
  if (book) {
    rows.push(setting(ui('track'), trackPicker(book) || h('p', { class: 'rn-lead' }, ui('oneTrack'))));
    rows.push(voiceSetting(book));
    rows.push(setting(ui('reset'), h('div', { class: 'toolbar' },
      action(ui('reset'), 'reset-book', { book: book.id }, 'btn btn--danger btn--sm'))));
  }
  // The registered module ids are a readout for whoever is writing a Book, and
  // a learner reading "exercises: jp.loanword, jp.song" learns nothing from
  // them, so they sit behind a disclosure. With no Book open the readout is of
  // nothing: "exercises: none" would report that the shell is empty rather
  // than that the visitor has not chosen yet.
  const ids = books.registeredIds();
  const list = (xs) => (xs.length ? xs.join(', ') : ui('none'));
  rows.push(h('details', { class: 'rn-setting rn-authors' }, [
    h('summary', { class: 'rn-authors-summary' }, ui('forAuthors')),
    h('p', { class: 'rn-lead' }, book
      ? `${ui('bookModules')}: ${ui('modExercises')}: ${list(ids.exercises)} · ${ui('modTransforms')}: ${list(ids.transforms)}`
      : ui('chooseBookFirst')),
  ]));
  return rows;
}
