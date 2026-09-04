// Input transforms for the Japanese Book. Contract C2.4, amended by C12 A16.
//
// The shell ships no transforms and resolves the id from the Book's registry.
// A kana input that accepts romaji typing is a Book capability, not a shell
// capability, which is the whole point: the Piano Book registers none and works.
//
// wanakana is vendored under js/vendor/ with its licence header and is never
// hot-linked (PLAN constraint 1). It is imported at the top of this module on
// purpose: a transform has to return a string synchronously, so it cannot wait
// on a dynamic import. The cost lands when this Book opens, not at boot.
//
// A transform has two halves (C12 A16): the live one runs per keystroke and
// must leave an unfinished syllable alone, and settle runs once at submit and
// finishes it. Both are needed, and neither does the other's job:
//
//   shinbun  live leaves しんぶn, because n could still become na. settle ends it.
//   onna     live must produce おんな, because settle sees only what is in the box.
//
// Why the live half is not wanakana's own IMEMode, measured on the vendored
// 5.3.1 against this Book's own words: the shell re-applies the transform to a
// box that already holds kana, so whatever IMEMode resolves early can never be
// revised. IMEMode reads "nn" as a finished ん, so onna typed o-n-n-a lands as
// おんあ and konnichiwa as こんいちは, and no settle step can recover them
// because the romaji they came from is gone. Holding the trailing run of n
// keeps it revisable, and n is the only thing that ever needs holding: it is
// the one kana that stands without a vowel. Every other unfinished cluster,
// k, sh, ky, is left alone by the plain reader already.

import { toHiragana, toKatakana } from '../../../js/vendor/wanakana.js';

/** A trailing n, nn or ny is not a syllable yet: na, nna and nya are all still open. */
const PENDING = /n+y?$/i;

/** Two or more n in front of anything that is not a vowel are one ん. */
const DOUBLED_N = /n{2,}(?![aiueoy])/gi;

/**
 * Build both halves of a romaji reader around one wanakana converter.
 *
 * Exported because two custom exercises in this Book own their input element
 * and their own grading, so they cannot go through the shell's transform hook
 * and would otherwise each reinvent this.
 *
 * @param {function} toKana toHiragana or toKatakana
 * @returns {function} the live transform, carrying its settle (C12 A16)
 */
export function kanaReader(toKana) {
  const live = (raw) => {
    const text = String(raw);
    const pending = PENDING.exec(text);
    const head = pending ? text.slice(0, pending.index) : text;
    return toKana(head.replace(DOUBLED_N, 'n')) + (pending ? pending[0] : '');
  };
  live.settle = (raw) => toKana(String(raw).replace(/n+$/i, 'n').replace(DOUBLED_N, 'n'));
  return live;
}

export default function register(runcible) {
  runcible.registerTransform('kana', kanaReader(toHiragana));
  runcible.registerTransform('kana-katakana', kanaReader(toKatakana));
}
