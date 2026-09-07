// Mounting an exercise: which host, what the marker says, and the way back.
//
// One exercise is mounted at a time. From 980px it runs on the facing page
// (#facing, a sticky column beside the prose), so the rule the learner just
// failed stays in view while they answer; below that it mounts inline under
// its own marker and the prose dims around it. Every type goes through the
// exercise engine, including deck, whose type hands the host to js/embed.js,
// the one implementation of the C6 embed contract.

import { state } from './state.js';
import { t, ui } from './i18n.js';
import { clear } from './utils.js';
import * as books from './books.js';
import * as progress from './progress.js';
import { action } from './render-shared.js';

// Must match the .rn-spread breakpoint in css/style.css exactly. It is the
// width at which a 66ch column and a 320px drill both fit, measured; below it
// there is one column and a drill mounts inline under its own marker.
const FACING = '(min-width: 980px)';
const mounted = new Map();   // exerciseId -> { destroy }
let repaint = null;          // render(), set once by js/render.js
let pending = null;          // { target, start? }, consumed after the next chapter paint

export function setRepaint(fn) { repaint = fn; }

/** Ask the next chapter paint to scroll to an element, and optionally start an exercise. */
export function setPending(p) { pending = p; }

function reduce() {
  return !!state.prefs.reduceMotion
    || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** Scroll an element by id into view, honouring the motion preference. */
export function scrollToId(id, block = 'start') {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block });
  return true;
}

function facing() { return document.getElementById('facing'); }
function markerOf(id) { return document.getElementById(`marker-${id}`); }

/** The beacon kit honours hidden on its link, so it steps aside while a drill runs. */
function beacon(hidden) {
  const b = document.getElementById('neo-beacon-link');
  if (b) b.hidden = hidden;
}

function setRunning(marker, on, inline) {
  if (!marker) return;
  marker.classList.toggle('rn-marker--running', on);
  const st = marker.querySelector('.rn-marker-state');
  if (st) st.textContent = on ? ui('running') : (st.dataset.earned || '');
  // A disabled Start beside a live Close is two controls for one thing, and the
  // marker already says "Running". Hidden, not disabled: there is nothing left
  // to press. destroyMounted() calls this with on=false before focusMarker(),
  // so the way back to the keyboard is unaffected.
  const btn = marker.querySelector('[data-action="start-exercise"]');
  if (btn) btn.hidden = on;

  // An inline drill has no facing bar to close it from, and Start is gone while
  // it runs, so the marker lends it one, in the same words and the same dress as
  // the facing bar's. On the facing page that bar already carries Close and a
  // second one would be two spellings of the one control.
  const toolbar = marker.querySelector('.toolbar');
  if (!toolbar) return;
  const close = toolbar.querySelector('[data-action="close-exercise"]');
  if (on && inline && !close) {
    toolbar.appendChild(action(ui('closeExercise'), 'close-exercise', {}, 'btn btn--ghost btn--sm'));
  } else if ((!on || !inline) && close) {
    close.remove();
  }
}

function focusMarker(id) {
  const m = markerOf(id);
  const btn = m && m.querySelector('[data-action="start-exercise"]');
  if (!btn) return;
  try { btn.focus({ preventScroll: true }); } catch { btn.focus(); }
}

/** Tear down whatever is mounted and put the page back the way it was. */
export function destroyMounted() {
  for (const [id, handle] of mounted) {
    try { handle.destroy(); } catch (e) { console.error('[runcible] exercise destroy failed', e); }
    setRunning(markerOf(id), false);
  }
  mounted.clear();
  const f = facing();
  if (f) {
    f.dataset.state = 'idle';
    f.setAttribute('aria-label', f.dataset.idleLabel || '');
    const host = f.querySelector('.rn-facing-host');
    if (host) clear(host);
  }
  const prose = document.getElementById('prose');
  if (prose) delete prose.dataset.running;
  delete document.body.dataset.exerciseOpen;
  beacon(false);
}

function findSpec(chapter, exerciseId) {
  for (const rung of chapter.rungs || []) {
    for (const ex of rung.exercises || []) if (ex.id === exerciseId) return { spec: ex, rungId: rung.id };
  }
  return { spec: null, rungId: null };
}

export async function startExercise(chapterId, exerciseId) {
  const book = state.book;
  const chapter = await books.loadChapter(book, chapterId);
  const { spec, rungId } = findSpec(chapter, exerciseId);
  if (!spec) throw new books.LoadError(`exercise "${exerciseId}" is not in this chapter`, chapterId);
  const inline = document.getElementById(`ex-${exerciseId}`);
  const marker = markerOf(exerciseId);
  if (!inline || !marker) return;
  destroyMounted();

  // The host is chosen by width at mount time. The facing column exists only
  // in the chapter spread, so a missing #facing also means inline.
  const f = facing();
  const onFacing = !!(f && matchMedia(FACING).matches);
  let host = inline;
  if (onFacing) {
    f.setAttribute('aria-label', t(spec.title) || spec.id);
    f.dataset.state = 'running';
    host = f.querySelector('.rn-facing-host');
  }
  setRunning(marker, true, !onFacing);
  document.body.dataset.exerciseOpen = exerciseId;
  const prose = document.getElementById('prose');
  if (prose && !onFacing) prose.dataset.running = exerciseId;
  beacon(true);

  const ctx = {
    book,
    chapter,
    exercise: spec,
    onDone: async (result) => {
      progress.markExercise(book.id, chapterId, exerciseId, result);
      // Completion, recorded per rung. It is never what passes a chapter (C3.4);
      // it is what Today reads to pick up where the learner stopped.
      if (rungId) progress.markRung(book.id, chapterId, rungId);
      destroyMounted();
      if (repaint) await repaint();
      focusMarker(exerciseId);
    },
  };
  const api = books.makeExerciseApi(ctx);
  // The content language is declared once, in the manifest. Filling it in here
  // keeps a chapter from repeating it on every listen and speak exercise, and
  // an exercise that states its own lang still wins.
  const resolved = spec.lang ? spec : { ...spec, lang: (book.lang && book.lang.content) || undefined };
  let handle;
  try {
    handle = books.engine().mount(host, resolved, api, { bookId: book.id, chapterId, rungId });
  } catch (e) {
    destroyMounted();
    throw e;
  }
  mounted.set(exerciseId, handle || { destroy() {} });
  // Inline: the prompt is the first thing in view after Start, not merely
  // "nearest", and .rn-ex-host carries the scroll margin that clears the bar.
  if (!onFacing) inline.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
  else f.scrollTop = 0;
}

/** Close the running exercise and hand focus back to its marker. */
export function closeExercise() {
  const ids = [...mounted.keys()];
  destroyMounted();
  if (ids[0]) focusMarker(ids[0]);
}

/**
 * The rail's overflow as an attribute the CSS can fade. Overlay scrollbars draw
 * nothing until the pointer moves, so a chapter whose rungs run past the bottom
 * of the sticky box read as a contents list that simply stopped. The attribute
 * goes again at the end of the scroll, so the fade is a promise of more rather
 * than a permanent dimming of the last row.
 */
function markRailOverflow() {
  const rail = document.querySelector('.rn-rail');
  if (!rail) return;
  rail.toggleAttribute('data-overflow', rail.scrollHeight - rail.scrollTop - rail.clientHeight > 4);
}

let railResizeBound = false;
function watchRail() {
  // Views are rebuilt wholesale, so the rail is a new element on every paint
  // and takes its own scroll listener. The window is bound once.
  const rail = document.querySelector('.rn-rail');
  if (rail) rail.addEventListener('scroll', markRailOverflow, { passive: true });
  markRailOverflow();
  if (railResizeBound) return;
  railResizeBound = true;
  addEventListener('resize', markRailOverflow, { passive: true });
}

/** Called by render() after every paint: honour a pending scroll or start. */
export async function afterPaint(route) {
  watchRail();
  const p = pending;
  pending = null;
  if (!p || route.name !== 'chapter') return;
  if (p.target) scrollToId(p.target, 'start');
  if (p.start) await startExercise(p.start.chapter, p.start.exercise);
}
