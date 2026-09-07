# Runcible assets

Hand-authored SVG for the book shell: one cover mark per chapter and a few
pieces the layout can place. No raster, no fonts, no `<text>`, nothing fetched.
Every file stands alone (no shared stylesheet, no `<use>` across files) so a
mark can be inlined, used as `<img>`, or set as a CSS `mask-image`.

Direction: `docs/DESIGN-BOOK.md` (frozen). Register: product, restrained
colour. The marks are the vignettes at the head of a printed chapter, not app
icons: an open figure standing on a ruled line, with one point of accent.

## Files

| File | Stands for | Figure |
|---|---|---|
| `marks/japanese/0-sounds.svg` | Why gandamu | Four equal beats; the second, the `n` an English speaker does not count, is accent |
| `marks/japanese/1-hiragana.svg` | Hiragana | One cursive stroke (ん), round joins; the spark is where the pen lands |
| `marks/japanese/2-katakana.svg` | Katakana | Two straight strokes (ラ), butt caps and miter joins; spark at the pen-down of the first stroke |
| `marks/japanese/3-songs.svg` | Songs | An eighth note standing on the lyric line; the head, the pitch you sing, is accent |
| `marks/japanese/4-first-words.svg` | First words | A glossary: word on the left, gloss on the right, three rows; the first word is accent |
| `marks/japanese/5-grammar.svg` | Grammar first steps | One line of the page broken into its words, between two dim lines; the accent is the last word, where Japanese puts the verb |
| `marks/japanese/6-kanji.svg` | Kanji beginnings | The practice square with dotted guides; the first stroke (一) is accent |
| `marks/japanese/7-listening-speaking.svg` | Listening and speaking | Sound arriving and sound leaving, meeting at one accent beat: you |
| `marks/japanese/8-study-plan.svg` | The study plan | Seven treads, the spark above the last |
| `marks/planned.svg` | Any chapter with `state: "planned"`, any Book | A dashed page, an ellipsis, the spark unlit |
| `marks/piano/book.svg` | The Piano Book, and its chapters until they get their own | Three white keys, two black, spark on the key to press |
| `pieces/beat-pulse.svg` | A beat in the loanword game | The beat tick with wings that pulse (see Motion) |
| `pieces/rung-marker.svg` | A rung line in the rail or contents | Two dim rails, three rungs, the middle one in ink |
| `pieces/seal-passed.svg` | A passed chapter goal | A stamp, struck a little off square: ring, dotted inner ring, check, all accent |
| `pieces/empty-state.svg` | Nothing here yet (no Book chosen, nothing answered) | An open book with blank pages, the spark unlit |
| `pieces/margin-tick.svg` | An exercise already earned, in the prose margin (design book, Magic 3) | Pencil-grey check |
| `pieces/bookmark.svg` | The ribbon, where a CSS `clip-path` is not wanted | Accent tab with a notch, 12 by 32 |

Resolution the shell can do without naming a subject:
`assets/marks/<bookId>/<chapterId>.svg`, else `assets/marks/planned.svg` when
the manifest entry is planned, else `assets/marks/<bookId>/book.svg`, else no
mark. Ids are the manifest ids, so a renamed chapter needs a renamed file.

## Grammar

**Grid.** `viewBox="0 0 48 48"` for every mark and for the seal and empty
state; 24 for the beat pulse, 16 for the rung marker and the tick, 12 by 32
for the bookmark. On a mark the safe area is 4 to 44 and only the spark's tip
may cross it; a piece has no ruled line to sit on and uses the box down to 2.

**The band.** Every mark's figure fills roughly `y` 12 to 37, so eleven marks
in a rail have one optical height rather than eleven. A figure that ends far
above the rule reads as a small icon dropped in a big box: that is what the
first cut of `0-sounds`, `4-first-words`, `5-grammar` and
`7-listening-speaking` did, and the contact sheet is where it showed.

**The ruled line.** Every cover mark stands on `M6 41h36`, a 1.5 hairline in
`--text-muted`. It is the line of the page the mark is written on: the
figure's lowest ink sits 3 to 5 units above it. Pieces do not carry it.

**Stroke.** Figure strokes are 3 units, `round` caps and joins. Guides (the
ruled line, the kanji square's dotted cross, the planned page's dashes, the
dim text lines in `5-grammar`) are 1.5 or 2 units in `--text-muted`, and
dashes are `2 3` or `4 3`. One sanctioned exception: `2-katakana.svg` uses
`butt` caps and `miter` joins, because angularity is that chapter's lesson and
the hiragana mark beside it is all curves.

**Corners.** Boxes use `rx="6"`, which is `--radius-sm` at 1:1 when the mark
is 48px. Small keys and pages use `rx="3"` (the piano keys, the planned page)
so a 22-unit rectangle does not turn into a pill.

**Colour, at most two neutrals plus the accent.** Colour is set in `style`
attributes as `var(--token, literal)`:

| Role | Declaration |
|---|---|
| ink | `stroke:var(--text-primary,#f9f9f9)` (or `fill:` for the note head and black keys) |
| dim | `stroke:var(--text-muted,rgba(255,255,255,.55))` |
| accent | `fill:var(--accent,#e11d48)` or `stroke:var(--accent,#e11d48)` |

Inlined, a mark takes the page's tokens, so a `?theme=` palette or a changed
`--accent` recolours it with no edit here. As an `<img>` or a mask it falls
back to the literals, which are the CDN base tokens and this site's accent.
There is no ground: marks are transparent and expect `--bg` behind them. Never
`--danger`, never `--accent-bright`, never a third literal.

**The accent appears once, and it means "look here first".** It takes one of
two forms, and the choice is not free:

- **Ink you should look at is drawn in the accent.** The second beat of
  `gandamu`, the note head, the first entry of the glossary, the verb at the
  end of the sentence, the first stroke in the practice square, the beat where
  listening and speaking meet.
- **A place with no ink gets the spark**, the favicon's spark at 2x
  (`M0-4.6l1.4 3.2 3.2 1.4-3.2 1.4-1.4 3.2-1.4-3.2-3.2-1.4 3.2-1.4z`, 9.2
  units across, placed with `transform="translate(x y)"`): the pen-down point
  before the stroke exists, the goal above the last tread, the key not yet
  pressed, the page not yet written.

A mark never has both, and a spark is never decoration beside a figure that
already carries its own accent. Four marks are sparks, six are accent ink; if
a new mark can go either way, prefer the ink.

The spark has two states. **Lit** (filled) means built or earned. **Unlit**
(1.5 stroke, no fill) means not yet: the planned chapters and the empty state.
The seal is the one asset drawn entirely in accent, because passed is the one
state the accent means on the rail.

**One motif crosses files: the beat.** A 3-unit vertical tick is a mora in
`0-sounds`, is you between the two sound arcs in `7-listening-speaking`, and
is the thing that pulses in `pieces/beat-pulse.svg`. Draw a beat that way or
not at all.

**Accessibility.** Every root carries `aria-hidden="true"` and no `<title>`:
the marks are decorative beside a chapter title that is already text, and a
learner-facing name would have to live in `js/i18n.js` as `{en, es}`, not in a
file that cannot carry two languages. When a mark must be named (the seal on
its own, say), the host sets `role="img"` and `aria-label` from the dictionary
and drops `aria-hidden`. Contrast of the accent on `--bg` is 4.3:1 and of the
dim stroke 6.2:1, both over the 3:1 graphics floor.

**Sizes that were read, not assumed.** 240 (chapter head), 96, 48 (contents,
Today), and 26 and 20 in a mock rail. 24 is the floor: below it the ruled line
turns into an underline under the glyph and the dashed `planned` page silts
up. In a list of rows, 28 or more.

## Motion

`pieces/beat-pulse.svg` is the only file with a `<style>`. The wings scale
from .55 to 1.45 and fade over 900ms on `cubic-bezier(.22,1,.36,1)`, the
site's `--ease-out`, on a loop; transform and opacity only, and the geometry is
sized so that scale 1.45 stays inside the viewBox (an SVG root clips). It
stops under `prefers-reduced-motion: reduce` and under any
`[data-reduce-motion]` ancestor (the site sets that on `<html>`), leaving the
wings at .5. The class name is prefixed `rna-` so an inlined copy cannot
collide with page CSS. **Inline it**: inside an `<img>` the wings render at
whatever frame the renderer stopped on, which is why the path also carries a
plain `opacity=".5"` attribute for that case. For one pulse per beat, inline
it once per beat and stagger with `style="animation-delay: …"` on
`.rna-wings`. Nothing else animates: the bookmark is a state, the seal is a
fact.

## Checks

```bash
for f in $(find assets -name '*.svg'); do xmllint --noout "$f"; done
find assets -type f -print0 | xargs -0 stat -f '%z' | awk '{s+=$1} END {print s " bytes"}'   # under 60 KB with this file
grep -rl --include='*.svg' '<text\|<image\|@import\|url(' assets   # must print nothing
```

Each SVG is under 1 KB. Marks were read at 48 and 240 on the CDN `--bg` via a
headless Chromium contact sheet; regenerate one the same way before changing a
stroke weight, since 1.5 at 48px is the floor of what still prints.
