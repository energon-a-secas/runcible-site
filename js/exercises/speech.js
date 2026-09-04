// ── Speech ───────────────────────────────────────────────────
// C2.5 freezes two facts here because each is a class of bug.
//
// 1. getVoices() is async on Chrome and returns an empty array until
//    voiceschanged fires. Firefox and Safari populate it synchronously. A
//    picker or a listen exercise that reads getVoices() once shows an empty
//    list on Chrome desktop and Chrome Android, which is most visitors. So
//    loadVoices() below never answers from a single synchronous read: when the
//    list is empty it waits for the event.
//
// 2. If no voice for the wanted language exists after voiceschanged, a listen
//    exercise degrades to text and says so, and an exercise whose only prompt
//    is audio is skipped rather than shown unanswerable. hasVoiceFor() is how a
//    type asks; types/listen.js is where the decision is made.
//
// SpeechRecognition is an enhancement and never a score. speak records
// correct: null always (C2.1), and the transcript is the learner's own
// feedback. Two authorities disagree about Safari and Edge support, so nothing
// here may gate progress on it.
//
// No language is named in this file. A spec says which language it wants; an
// engine that defaulted to one would be a topic aware engine.

/** How long to wait for voiceschanged before concluding the list is what it is. */
const VOICES_TIMEOUT_MS = 1500;

let cached = null;
let pendingVoices = null;
let watching = false;

/** Is the synthesis API present at all. */
export function synthAvailable() {
  return typeof globalThis !== 'undefined'
    && typeof globalThis.speechSynthesis !== 'undefined'
    && typeof globalThis.SpeechSynthesisUtterance === 'function';
}

/**
 * The voice list, waiting for voiceschanged when the first read is empty.
 *
 * The timeout is not a guard against a slow browser. A device with no voices at
 * all never fires voiceschanged, and without a deadline "after voiceschanged"
 * has no moment, so every listen exercise would wait forever instead of
 * degrading. The persistent listener below keeps the cache fresh afterwards, so
 * a late arrival still upgrades the next question.
 *
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function loadVoices() {
  if (!synthAvailable()) return Promise.resolve([]);
  const synth = globalThis.speechSynthesis;

  if (!watching) {
    watching = true;
    synth.addEventListener('voiceschanged', () => {
      cached = synth.getVoices() || [];
    });
  }

  const now = synth.getVoices() || [];
  if (now.length) { cached = now; return Promise.resolve(now); }
  if (cached && cached.length) return Promise.resolve(cached);
  if (pendingVoices) return pendingVoices;

  pendingVoices = new Promise((resolve) => {
    let settled = false;
    let timer = 0;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', settle);
      cached = synth.getVoices() || [];
      pendingVoices = null;
      resolve(cached);
    };
    synth.addEventListener('voiceschanged', settle);
    timer = setTimeout(settle, VOICES_TIMEOUT_MS);
  });
  return pendingVoices;
}

/** ja-JP, ja_JP and ja all reduce to "ja". */
function primary(tag) {
  return String(tag || '').replace(/_/g, '-').toLowerCase().split('-')[0];
}

/**
 * Voices for a BCP 47 tag, best match first: exact tag, then same primary
 * subtag, then the platform default voice.
 * @param {string} lang
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export async function voicesFor(lang) {
  const all = await loadVoices();
  if (!lang) return all;
  const wanted = String(lang).replace(/_/g, '-').toLowerCase();
  const exact = all.filter((v) => String(v.lang).replace(/_/g, '-').toLowerCase() === wanted);
  const near = all.filter((v) => primary(v.lang) === primary(wanted) && !exact.includes(v));
  return exact.concat(near);
}

/**
 * Can this device speak this language. The answer is only meaningful after
 * loadVoices() has resolved, which is why it is async.
 * @param {string} lang
 * @returns {Promise<boolean>}
 */
export async function hasVoiceFor(lang) {
  if (!synthAvailable()) return false;
  if (!lang) return (await loadVoices()).length > 0;
  return (await voicesFor(lang)).length > 0;
}

/**
 * Speak. Resolves when the utterance ends, or false when it could not start.
 * @param {string} text
 * @param {{lang?: string, rate?: number, pitch?: number, voiceURI?: string}} [opts]
 * @returns {Promise<boolean>}
 */
export async function speak(text, opts) {
  const o = opts || {};
  if (!synthAvailable() || !text) return false;
  const synth = globalThis.speechSynthesis;
  const candidates = await voicesFor(o.lang);
  const voice = o.voiceURI
    ? candidates.find((v) => v.voiceURI === o.voiceURI) || candidates[0]
    : candidates[0];

  return new Promise((resolve) => {
    synth.cancel();
    const u = new globalThis.SpeechSynthesisUtterance(String(text));
    if (o.lang) u.lang = o.lang;
    if (voice) u.voice = voice;
    if (Number.isFinite(o.rate)) u.rate = o.rate;
    if (Number.isFinite(o.pitch)) u.pitch = o.pitch;
    u.addEventListener('end', () => resolve(true));
    u.addEventListener('error', () => resolve(false));
    synth.speak(u);
  });
}

/** Stop whatever is being said. Called on unmount so a destroyed exercise goes quiet. */
export function cancelSpeech() {
  if (synthAvailable()) globalThis.speechSynthesis.cancel();
}

function recognitionCtor() {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;
}

/**
 * Is recognition present. Never a gate on progress: C2.5 and DESIGN Q6 both say
 * the transcript is feedback, not a score.
 */
export function recognitionAvailable() {
  return recognitionCtor() !== null;
}

/**
 * Listen once and return what was heard, or null.
 *
 * Rejection is not used: a learner denying the microphone is a normal outcome,
 * not an exception. A recognition error resolves with an empty transcript and
 * the error name, so the caller can tell a blocked microphone from silence
 * and say which one it was.
 *
 * @param {{lang?: string, timeoutMs?: number}} [opts]
 * @returns {Promise<{transcript: string, confidence: number, error?: string}|null>}
 */
export function listenOnce(opts) {
  const o = opts || {};
  const Ctor = recognitionCtor();
  if (!Ctor) return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { rec.stop(); } catch { /* already stopped */ }
      resolve(value);
    };
    const rec = new Ctor();
    if (o.lang) rec.lang = o.lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.addEventListener('result', (e) => {
      const alt = e.results && e.results[0] && e.results[0][0];
      finish(alt ? { transcript: String(alt.transcript || ''), confidence: Number(alt.confidence) || 0 } : null);
    });
    rec.addEventListener('error', (e) => finish({ transcript: '', confidence: 0, error: String((e && e.error) || 'error') }));
    rec.addEventListener('end', () => finish(null));
    const timer = setTimeout(() => finish(null), Number.isFinite(o.timeoutMs) ? o.timeoutMs : 8000);
    try { rec.start(); } catch { finish(null); }
  });
}

/**
 * Options for api.tts. spec.lang is only included when the chapter set one:
 * passing lang: undefined would override the Book's own content language,
 * which is the default the shell folds in (js/books.js makeExerciseApi).
 */
export function speakOpts(spec) {
  const o = {};
  if (spec.lang) o.lang = spec.lang;
  if (Number.isFinite(spec.rate)) o.rate = spec.rate;
  return o;
}

const langWarned = new Set();

/**
 * Warn once when a speaking exercise names no language.
 *
 * C2.5 degrades a listen exercise when no voice exists "for ja". The api the
 * exercise is handed (C2.3) exposes attempt, t, lang, data, tts and done, and
 * none of them is the Book's content language, so the only place this engine
 * can learn it is the spec. Without it the probe asks "is there any voice at
 * all", which is true nearly everywhere, and the degrade path never fires: the
 * learner gets the right text read in the wrong language instead of the honest
 * fallback. Said out loud rather than guessed at.
 */
export function warnMissingLang(spec) {
  if (spec.lang || langWarned.has(spec.id)) return;
  langWarned.add(spec.id);
  console.warn(
    `[runcible] "${spec.id}" is a ${spec.type} exercise with no "lang". The C2.5 check for ` +
    '"no voice for this language" cannot run without one, so this exercise will speak with ' +
    'whatever voice the platform picks and will never degrade to text.');
}

/**
 * The default api.tts implementation. C2.3 puts api.tts on the frozen api
 * object the shell hands a Book module; this is the body the shell should use
 * so there is one speech path with one voiceschanged listener rather than two.
 */
export const tts = speak;
