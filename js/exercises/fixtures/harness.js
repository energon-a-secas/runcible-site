// ── Engine harness ───────────────────────────────────────────
// A1b's own test rig, under A1b's own path. It stands in for the shell so the
// nine types can be answered in a real browser before js/app.js exists, and it
// stays useful afterwards as the place to reproduce an exercise bug without a
// Book, a router or progress in the way.
//
// The two things it fakes are exactly the two the shell owns:
//
//   api.data   the C3.2 pointer resolver, "<path>#<dotted.path>", refusing any
//              path the chapter did not declare (C1 rule 2)
//   api.t      the {en,es} resolver, English first per C's convention 2
//
// Everything else is the real engine.

import { createExerciseRegistry, EXERCISE_VERSION } from '../index.js';
import { tts } from '../speech.js';
// The shell imports index.js and nothing else (README). The harness is the
// engine's own rig, so it reaches into the module whose rules it is checking:
// these four are how every type reads an item field.
import { useLanguage, fieldValue, displayValue, itemIdOf } from '../items.js';
import register, { PROVIDES } from './book-module.js';

const BASE = '../';
const $ = (id) => document.getElementById(id);

const registry = createExerciseRegistry();
let chapter = null;
let mounted = null;
let lang = 'en';
let attempts = 0;

function log(kind, payload) {
  const row = document.createElement('div');
  row.className = 'hz-row';
  row.dataset.kind = kind;
  const tag = document.createElement('span');
  tag.className = 'hz-tag';
  tag.textContent = kind;
  const body = document.createElement('code');
  body.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload);
  row.append(tag, body);
  $('log').prepend(row);
}

/** C's convention 2: a bare string is legal, English is the fallback, then Spanish. */
function t(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value;
  const pick = value[lang];
  if (pick !== undefined && pick !== null) return pick;
  if (value.en !== undefined && value.en !== null) return value.en;
  return '';
}

const docs = new Map();

function fragment(doc, path) {
  if (!path) return doc;
  if (doc && typeof doc === 'object' && path in doc) return doc[path];
  let cur = doc;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

async function data(pointer) {
  const [path, frag] = String(pointer).split('#');
  const declared = chapter && Array.isArray(chapter.data) ? chapter.data : [];
  if (!declared.includes(path)) {
    throw new Error(`"${path}" is not in this chapter's declared data list, so the shell refuses it (C1 rule 2)`);
  }
  if (!docs.has(path)) {
    const res = await fetch(BASE + path);
    if (!res.ok) throw new Error(`${path} fetched ${res.status}`);
    docs.set(path, await res.json());
  }
  return fragment(docs.get(path), frag);
}

function apiFor(spec) {
  return Object.freeze({
    attempt(a) {
      attempts += 1;
      $('count').textContent = String(attempts);
      log('attempt', a);
      const missing = ['itemId', 'skill', 'ms'].filter((k) => a[k] === undefined || a[k] === null);
      if (missing.length) log('BAD ATTEMPT', `missing ${missing.join(', ')}`);
      if (!(a.correct === true || a.correct === false || a.correct === null)) {
        log('BAD ATTEMPT', `correct is ${JSON.stringify(a.correct)}, must be true, false or null`);
      }
      if (spec.type === 'read' || spec.type === 'speak') {
        if (a.correct !== null) log('BAD ATTEMPT', `${spec.type} must always record correct: null`);
      }
    },
    t,
    lang,
    data,
    // The shell folds the Book's content language in here (js/books.js
    // makeExerciseApi). The harness does the same so a spec with no lang
    // behaves the same way in both.
    tts: (text, opts) => tts(text, { lang: 'en', ...opts }),
    done(summary) { log('done', summary === undefined ? '(no summary)' : summary); },
  });
}

function unmount() {
  if (mounted && typeof mounted.destroy === 'function') mounted.destroy();
  mounted = null;
  $('host').replaceChildren();
}

/** The context the shell passes to mount(). js/render.js sends exactly this. */
function ctxFor() {
  return { bookId: 'fixture', chapterId: chapter.id, rungId: chapter.rungs[0].id };
}

function run(spec) {
  unmount();
  log('mount', `${spec.type}: ${spec.id}`);
  try {
    mounted = registry.mount($('host'), spec, apiFor(spec), ctxFor());
  } catch (err) {
    log('LOAD ERROR', err.message);
    console.error(err);
  }
}

function exerciseList() {
  const list = $('picker');
  list.replaceChildren();
  for (const spec of chapter.rungs[0].exercises) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--secondary hz-pick';
    b.textContent = `${spec.type}  ${spec.id}`;
    b.addEventListener('click', () => run(spec));
    list.appendChild(b);
  }
}

/** The contract's refusals and acceptances, checked here because a browser cannot show them. */
function contractChecks() {
  const out = [];
  const probe = createExerciseRegistry();

  const expectThrow = (label, fn) => {
    try { fn(); out.push([label, 'NOT REFUSED', false]); } catch (err) { out.push([label, `refused: ${err.message}`, true]); }
  };
  // A rule that says something must be accepted needs a check that fails when
  // it is not. C12 A10 was a rule of that shape, and the panel below had only
  // refusals, which is why nothing here noticed.
  const expectOk = (label, fn) => {
    try { fn(); out.push([label, 'accepted', true]); } catch (err) { out.push([label, `REFUSED: ${err.message}`, false]); }
  };

  expectThrow('a Book registering an id with no dot', () => {
    probe.registerBookModule({
      bookId: 'probe', provides: { exercises: ['loanword'] },
      register: (r) => r.registerExercise('loanword', { mount() {} }),
    });
  });
  expectThrow('a Book shadowing the generic type "typed"', () => {
    probe.registerBookModule({
      bookId: 'probe', provides: { exercises: ['typed.mine'] },
      register: (r) => r.registerExercise('typed.mine', { mount() {} }),
    });
  });
  expectThrow('a Book registering something it did not declare', () => {
    probe.registerBookModule({
      bookId: 'probe', provides: { exercises: [] },
      register: (r) => r.registerExercise('probe.sneaky', { mount() {} }),
    });
  });
  expectThrow('a Book declaring something it did not register', () => {
    probe.registerBookModule({
      bookId: 'probe', provides: { transforms: ['probe.absent'] },
      register: () => {},
    });
  });
  expectThrow('a typed spec naming an unregistered transform', () => {
    probe.mount(document.createElement('div'), {
      id: 'p1', type: 'typed', skill: 's', items: [{ a: 1 }], prompt: 'a', answer: 'a', transform: 'nope.here',
    }, { attempt() {} }, { bookId: 'probe', chapterId: 'c1' });
  });
  expectThrow('a chapter using a dotted registered id as a type', () => {
    probe.mount(document.createElement('div'), {
      id: 'p2', type: 'demo.reveal', skill: 's',
    }, { attempt() {} }, { bookId: 'probe', chapterId: 'c1' });
  });

  // C12 A10: a transform id is free form, an exercise id keeps the dot rule.
  // These are C1.2's and C2.4's own worked examples, so a build that refuses
  // them cannot run the Japanese Book.
  for (const id of ['kana', 'kana-katakana']) {
    expectOk(`a Book registering the transform "${id}"`, () => {
      probe.registerBookModule({
        bookId: 'probe', provides: { transforms: [id] },
        register: (r) => r.registerTransform(id, (raw) => raw),
      });
    });
  }
  expectThrow('a Book registering the exercise "typed"', () => {
    probe.registerBookModule({
      bookId: 'probe', provides: { exercises: ['typed'] },
      register: (r) => r.registerExercise('typed', { mount() {} }),
    });
  });
  expectOk('a Book registering the exercise "jp.loanword"', () => {
    probe.registerBookModule({
      bookId: 'probe', provides: { exercises: ['jp.loanword'] },
      register: (r) => r.registerExercise('jp.loanword', { mount() {} }),
    });
  });

  // ── Bilingual item fields, and the identity that must not move ─────────
  // An { en, es } object in an item field used to mount blank, because
  // displayValue returned '' for any object and fieldValue handed the object
  // straight back. A blank prompt is the failure nobody reading this page
  // would notice, so the rules that replaced it are asserted rather than
  // looked at. A row returning anything but true prints what it got.
  const holds = (label, fn) => {
    try {
      const got = fn();
      out.push([label, got === true ? 'holds' : `BROKEN: ${got}`, got === true]);
    } catch (err) { out.push([label, `THREW: ${err.message}`, false]); }
  };
  const item = { name: 'Mercury', nick: { en: 'the swift one', es: 'el veloz' }, code: 'ME' };
  const enOnly = { gloss: { en: 'the swift one' } };
  const probeSpec = { id: 'probe-bilingual' };
  const read = (lang, fn) => { useLanguage({ lang, t }); return fn(); };

  holds('a bilingual item field resolves to the reader\'s language', () => {
    const es = read('es', () => displayValue(fieldValue(item, 'nick')));
    const en = read('en', () => displayValue(fieldValue(item, 'nick')));
    return (es === 'el veloz' && en === 'the swift one') || `es gave "${es}", en gave "${en}"`;
  });
  holds('an untranslated field falls back to English rather than to a blank', () => {
    const es = read('es', () => displayValue(fieldValue(enOnly, 'gloss')));
    return es === 'the swift one' || `es gave "${es}"`;
  });
  holds('a plain string field is handed back untouched', () => {
    const es = read('es', () => displayValue(fieldValue(item, 'code')));
    return es === 'ME' || `es gave "${es}"`;
  });
  holds('a bilingual list field gives that language\'s list, not a joined string', () => {
    const seq = read('es', () => fieldValue({ names: { en: ['a', 'b'], es: ['x', 'y'] } }, 'names'));
    return (Array.isArray(seq) && seq.join(',') === 'x,y') || `es gave ${JSON.stringify(seq)}`;
  });
  holds('the itemId of a bilingual field carries no language (C2.6)', () => {
    const es = read('es', () => itemIdOf(item, probeSpec, 'nick', 0));
    const en = read('en', () => itemIdOf(item, probeSpec, 'nick', 0));
    return (es === en && es === 'the swift one') || `es wrote "${es}", en wrote "${en}"`;
  });
  // Leave the module the way the picker expects to find it.
  useLanguage({ lang, t });

  const panel = $('checks');
  panel.replaceChildren();
  for (const [label, result, ok] of out) {
    const row = document.createElement('div');
    row.className = 'hz-row';
    row.dataset.kind = ok ? 'ok' : 'bad';
    const tag = document.createElement('span');
    tag.className = 'hz-tag';
    tag.textContent = ok ? 'ok' : 'FAIL';
    const body = document.createElement('code');
    body.textContent = `${label} -> ${result}`;
    row.append(tag, body);
    panel.appendChild(row);
  }
}

async function boot() {
  $('version').textContent = EXERCISE_VERSION;
  const res = await fetch('chapter.json');
  chapter = await res.json();
  registry.registerBookModule({
    bookId: 'fixture', path: 'fixtures/book-module.js', register, provides: PROVIDES,
  });
  log('book', `registered exercises ${registry.listExercises().join(', ')} and transforms ${registry.listTransforms().join(', ')}`);
  exerciseList();
  contractChecks();

  $('lang').addEventListener('change', (e) => { lang = e.target.value; exerciseList(); });
  $('clear').addEventListener('click', () => { $('log').replaceChildren(); attempts = 0; $('count').textContent = '0'; });
  $('unmount').addEventListener('click', unmount);
}

boot().catch((err) => { log('BOOT FAILED', err.message); console.error(err); });
