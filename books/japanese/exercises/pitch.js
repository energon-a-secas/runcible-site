// jp.pitch: the four accent patterns, on one screen, with a pitch line.
//
// Never graded. DESIGN Q6 ships the pitch primer as static content and ships no
// pronunciation score anywhere, because the only API that could produce one is
// contradicted at the source about two of the four major browsers.
//
// The shell draws geometry rather than markup and a figure needs path strings
// from a declared data file (js/render.js), and there is no pitch data file. So
// the shape is computed here from a levels array that lives in the chapter, and
// every element is created rather than parsed. No innerHTML, no injected SVG.
//
// The content is deliberately thin. The research is blunt about why: of the
// three hashi words drawn here, bridge (odaka) and edge (heiban) are identical
// in isolation and only part when a particle follows, so a beginner with no
// particles yet cannot hear the thing the example teaches. Chopsticks
// (atamadaka) differs from both even alone, because its drop is inside the
// word. Mention it on day one, do not drill it.

import { el, add, clear, button, listeners, frame } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const STEP = 46;
const HIGH = 18;
const LOW = 52;
const PAD = 24;

function svgEl(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, String(v));
  return node;
}

/**
 * A pitch line over one word. `levels` is one number per beat, 1 high and 0
 * low, and its length is the number of beats including any attached particle.
 */
function pitchLine(levels, beats) {
  const n = Math.max(levels.length, 1);
  const width = PAD * 2 + STEP * (n - 1);
  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} 78`,
    class: 'jp-pitch-svg',
    role: 'img',
    'aria-label': `pitch: ${levels.map((v) => (v ? 'high' : 'low')).join(', ')}`,
  });
  const y = (i) => (levels[i] ? HIGH : LOW);
  const x = (i) => PAD + STEP * i;

  let d = `M${x(0)},${y(0)}`;
  for (let i = 1; i < n; i++) d += ` L${x(i)},${y(i - 1)} L${x(i)},${y(i)}`;
  svg.appendChild(svgEl('path', { d, class: 'jp-pitch-path', fill: 'none' }));

  for (let i = 0; i < n; i++) {
    svg.appendChild(svgEl('circle', { cx: x(i), cy: y(i), r: 4, class: 'jp-pitch-dot' }));
    const label = svgEl('text', { x: x(i), y: 72, 'text-anchor': 'middle', class: 'jp-pitch-beat' });
    label.textContent = beats[i] || '';
    svg.appendChild(label);
  }
  return svg;
}

/** One beat per kana, with a small kana staying attached to the one before it. */
function beatsOf(word) {
  const small = 'ゃゅょぁぃぅぇぉャュョァィゥェォ';
  const out = [];
  for (const ch of String(word || '')) {
    if (out.length && small.includes(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

export default function register(runcible) {
  runcible.registerExercise('jp.pitch', {
    // Never graded: Today must not offer it as the day's game or count it as a drill.
    graded: false,
    mount(host, spec, api) {
      const bound = listeners();
      let alive = true;
      const props = spec.props || {};
      const view = frame(host, {
        title: api.t(spec.title) || 'Where the pitch drops',
        lead: 'Japanese separates words by where the pitch falls, not by which beat is louder.',
        cls: 'jp--pitch',
      });
      const trouble = el('p', { class: 'jp-note' });

      function row(entry) {
        const beats = beatsOf(entry.word);
        const levels = Array.isArray(entry.levels) ? entry.levels : [];
        const play = button('Hear it', () => {
          Promise.resolve(api.tts(entry.word)).then((ok) => {
            if (alive && !ok) trouble.textContent = 'This browser has no Japanese voice, so there is no audio here. The shape of the line is still the lesson.';
          });
          api.attempt({ itemId: `pitch:${entry.id || entry.word}`, skill: spec.skill, correct: null, ms: 0 });
        }, 'btn btn--ghost btn--sm');

        return el('div', { class: 'jp-pitch-row' }, [
          el('h5', { class: 'jp-sub', text: entry.name ? `${entry.name}  ${entry.ja || ''}`.trim() : entry.word }),
          pitchLine(levels, beats),
          el('p', { class: 'jp-kana', lang: 'ja', text: entry.word }),
          entry.gloss ? el('p', { class: 'jp-note', text: entry.gloss }) : null,
          entry.note ? el('p', { class: 'jp-note', text: entry.note }) : null,
          play,
        ]);
      }

      const patterns = Array.isArray(props.patterns) ? props.patterns : [];
      const contrast = Array.isArray(props.contrast) ? props.contrast : [];

      if (!patterns.length && !contrast.length) {
        view.status.textContent = 'This primer was given no patterns to draw.';
      } else {
        view.status.textContent = 'Nothing here is scored.';
        add(view.body, [
          patterns.length ? el('h5', { class: 'jp-sub', text: 'The four shapes' }) : null,
          ...patterns.map(row),
          contrast.length ? el('h5', { class: 'jp-sub', text: 'The three worth hearing' }) : null,
          ...contrast.map(row),
          props.closing ? el('p', { class: 'jp-note', text: props.closing }) : null,
          trouble,
        ]);
      }
      add(view.foot, button('Done', () => api.done({ graded: false }), 'btn btn--primary'));

      return {
        destroy() {
          alive = false;
          bound.off();
          if (globalThis.speechSynthesis) globalThis.speechSynthesis.cancel();
          clear(host);
        },
      };
    },
  });
}
