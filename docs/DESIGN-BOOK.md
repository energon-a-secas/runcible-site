# Runcible as a book

Design direction for the shell, 2026-09-04. Register: product (impeccable). Scene: an adult
with twenty minutes, phone on a train or laptop at a kitchen table after dark, reading a chapter
and answering as they go. The fleet's `base.css` is dark and is not this site's to change, so
the palette question is settled upstream; what this document decides is structure, type, the
exercise panel, feedback, and motion. Screenshots read for this: `/private/tmp/claude-501/runcible-shots/dl-*.png`
(today, books, ladder, ch4, e-beats, e-beats-wrong, e-epenthesis, e-hear-loanwords, loanword) at 390, 820 and 1280.

## What the shots show

- Every screen is a stack of same-sized cards: 13 identical chapter cards on the ladder, three
  cards on Today, one card per exercise. Cards and 3px `border-left` stripes (`.rn-chapter`,
  `.rn-callout`, `.rx-callout`) are on the impeccable ban list, and they are why the page
  "feels pressured": every block is boxed, so nothing has room.
- The reading column is right (68ch), but at 1280 it sits in a 900px container with the two
  gutters empty. A book puts something in a gutter.
- Exercise titles render twice (the `.rn-ex` head and the session `<h3>`), the engine type
  (`choice`, `match`, `custom`) leaks in monospace, and the option labels are `1. 5`, `2. 4`,
  `3. 6`, `4. 2` on the beats drill: a prefix that reads as an option.
- After a wrong answer the wrong button gets `--danger` and the right one gets `--accent`;
  both are red. The distinction is invisible.
- The pairs board shows `risk, ending in k` beside `u, so risuku`; the right column quotes the
  left. On 390 the feedback line lands under the beacon button and the back-to-top button.
- Readouts say `0/12 attempts · 0% correct · Goal 80%` under a 6px bar. That is a dashboard.
- The Book module `jp.loanword` has no styles at all (`jp-*` classes are unstyled); its
  verdict is eight unstyled lines. Out of scope for the shell, noted for the Book's owner.

## The reading column

- Measure: `max-width: 66ch` on prose, tables and figures may run to the column edge (up to
  `min(66ch, 100%)` for text, `100%` for `.rn-table` inside an `overflow-x:auto` wrapper).
- Type scale, fleet tokens only, ratio about 1.2: chapter title `--text-2xl` 600; rung title
  `--text-xl` 600 (today rungs are uppercase `--text-sm` labels, which flattens the hierarchy
  below the page titles); page title `--text-lg` 600; body `--text-base`, line-height 1.65,
  `--text-secondary`; notes and captions `--text-sm` `--text-muted`. No uppercase labels in
  the reading column; uppercase stays for the rail's section names.
- Rhythm: paragraphs `--space-4`; a page (`.rn-page`) to the next `--space-6`; a rung to the
  next 56px (`.stack--loose`) with a hairline rule; the exercise marker (below) gets
  `--space-6` above and below so the prose visibly pauses there.
- Callouts lose the stripe: full 1px `--border` and a `color-mix(in srgb, var(--accent) 6%,
  transparent)` wash for `win`, `--danger` at 6% for `warn`, plain surface for `note`, with the
  title as the only bold element. No card shadows, no hover lift on anything that is not a link.
- Ordered content that is an actual list (the study plan, an epenthesis table of examples) is
  an `<ol>` with the numbers in the margin (`list-style-position: outside`, margin-left 1.6em)
  so numbers never sit inside the text block where they read as options.

## The rail (table of contents)

- From 1180px: a 220px left rail, `position: sticky; top: 84px` (clears the content header),
  `align-self: start`. It lists the Book's chapters as lines, not cards: state glyph, title,
  and for the open chapter its rungs indented beneath, the current rung carrying the bookmark
  ribbon (see Magic). State is shown by the glyph plus text for assistive tech: `●` passed
  (accent), `○` open, `◌` locked (muted), `…` not built yet. Locked rows keep their override
  link as a small text link, never a button per row: one `openAnyway` per locked chapter is
  already the contract, it just stops being a 36px button repeated thirteen times.
- Between 900 and 1179: the rail collapses into a page bar, 40px, sticky under the header:
  `Contents ▾ · First words · Greetings`. Opening it is a disclosure panel that pushes the
  page down (not a modal, not a drawer). Below 900 the same bar, with the chapter title
  truncated first, then the rung.
- The Book page (`#/b/japanese`) becomes the rail's content laid out as a contents page: book
  glyph and goal at the top, then the chapter list at full width with each chapter's one-line
  statement, then tracks as a segmented control under the goal. No progress bars on this page;
  the evidence sentence appears on hover/focus (`title`) and in full on the chapter itself.

## Where the exercise sits

Decision: a facing page on wide screens, inline on narrow. Reading and answering are two
modes, the drill repaints every question while the prose must not move, and the rule the
learner just failed is on the prose page, so keeping both visible is the teaching.

- Wide (≥ 1180, sketch): `[rail 220] [prose, 66ch] [facing 360]`. In the prose, where the
  chapter authored the exercise, a **marker** replaces today's `.rn-ex` box: a hairline rule,
  `Try it` in `--text-sm` uppercase, the exercise title in `--text-lg`, one `Start` button.
  Pressing it opens the facing page: a sticky column (`top: 84px`, max-height
  `calc(100dvh - 100px)`, `overflow:auto`) that holds the running exercise. The marker stays
  put and shows `Running` while the panel is open. Closing the panel or finishing returns
  focus to the marker. The panel is one element with `role="region"` and
  `aria-label={exercise title}`; at most one exercise is mounted at a time (already true).
- Middle (900 to 1179): the rail is the page bar, so it is `[prose] [facing 340]`.
- Narrow (< 900): the exercise mounts inline under its marker, full column width, with the
  prose above it dimmed to `--text-muted` while it runs so the eye has one live region. The
  prompt line is the first thing in view after `Start` (scroll `block:'start'`, not
  `'nearest'`), and the beacon button hides while an exercise runs (`.rx` present toggles
  `body[data-exercise-open]`, the beacon kit honours `hidden` on its host).
- `js/render.js` today mounts into `#ex-<id>` inside the prose; the facing page is a second
  host, `#facing`, chosen by width (`matchMedia('(min-width: 900px)')`) at mount time.

## The exercise panel

- Head: the exercise title once (drop the `.rn-ex` duplicate), the position as
  `Question {at} of {total}` right-aligned in `--text-sm`, no type label.
- Prompt: `--text-2xl` for a single glyph or word, `--text-xl` when it wraps to two lines.
- Options: a vertical list of rows, one per option, each row a `<button>` laid out as
  `[keycap] [label]`. The keycap is a 28px `<kbd>` box, monospace, 1px `--border-strong`,
  `--surface-2`, showing `1`..`9`; the label is the option text alone. **No prefix in the
  label ever**: `askChoice` stops building `${i + 1}. ${label}`. Rows are 44px tall, full
  column width, so a 390 screen gets a clean stack rather than four pills that wrap.
- Numeral options: when every option label is a bare integer 1 to 9 (`/^[1-9]$/` on all of
  them), the keycap is omitted and the label is set as the keycap: a row of square boxes
  showing `5 4 6 2`, and `digitPicker` maps the pressed digit to the option whose label equals
  it, not to the index. Any other label set (`i a u`, `card internet robot`) keeps keycaps 1..n.
- Keyboard hint, once per exercise under the options in `--text-xs`: `keyHint` (below).
- Right and wrong are shapes, not two reds: the correct option fills `color-mix(in srgb,
  var(--accent) 22%, transparent)` with a `✓` in its keycap; the chosen wrong option keeps its
  border, strikes its label (`text-decoration: line-through`) and dims to 0.6. `--danger`
  leaves the exercise vocabulary; it stays for destructive actions.
- Pairs: the board becomes `[prompt column] [answer column]`, status line **above** the board
  so it is never under a floating button, made pairs move to a `Paired` list under the board
  as they lock. The answer column must not restate the prompt: the `right` field is the answer
  alone (`u`), and a new optional field `reveal` (the item field name, e.g. `"reveal":
  "example"`) is shown beside a locked pair: `risk, ending in k: u, so risuku`. The Book's
  `e-epenthesis` items split `vowel` into `vowel: "u"` and `example: "so risuku"`. The
  validator should warn when a right value contains the left value's first word (tools/ is
  another workflow's; this is the request).

## Feedback after a wrong answer

A panel under the options, `role="status"`, revealed by opacity only. Three lines at most:

1. `yourAnswer`: what was chosen, struck. `rightAnswer`: the expected label, in `--text-lg`.
2. `because`: one sentence of why, drawn from the item, in this order of preference:
   `item.explain` ({en,es} or string) · `item.rule` (a string or array of rule ids) resolved
   against `chapter.rules[<id>]` ({ `title`, `text`, `examples[]` } with {en,es} values) or,
   when the spec carries `props.rules`, against that list's `rule` and `examples_text` fields
   (the shape `data/loanwords/rules.json` already has) · `item.confusables` (the shape
   `data/kana/*.json` already carries) rendered as `notThis` · nothing, in which case only line 1.
3. `seeRule`: a link that scrolls the prose to the page carrying that rule. Pages gain an
   optional `id`, and `chapter.rules[<id>].page` names one; on wide the page highlights
   (Magic 2), on narrow the panel quotes its first sentence instead.

The engine reads `explain`, `rule`, `confusables`, `reveal`, `chapter.rules`, `page.id`,
`rules[].page`; content can start carrying them before the engine renders them. The attempt
payload is unchanged (C2.3). When `accept` has two spellings, `bothRight` is line 2.

## Progress and goal, as a book's

- Position: `Question 3 of 8` inside an exercise, `Page 2 of 6` in the page bar (a page is a
  rung), `Chapter 4 of 9` in the rail's header. No bars for position.
- Evidence: one sentence, no percentage pair. `passesAt` then `soFar`: "Passes at 80% over 12
  answers. So far: 9 of 12 right." or `noneYet`. Under the chapter title only, `--text-sm`
  muted, plus a 2px hairline that fills as a proportion of `min`, the width of the title, the
  colour `--accent`. On the rail, the passed glyph is the whole readout.
- The exercise tick (`spec.pass`) shows in the marker as `Done · 88%` (`earned`), never in the
  rail.

## Motion

Ease `--ease-out` everywhere, no bounce. Chapter change: the reading column fades in from
opacity 0 and translates 8px up, 180ms. Facing page: opacity plus 12px translate from the
right, 220ms; inline on narrow: 12px from below. Option press: 60ms scale to 0.98 (exists).
Feedback: opacity only, 150ms. Bookmark ribbon: none, it is a state. Layout properties are
never animated. `prefers-reduced-motion` and `html[data-reduce-motion]` set every duration to
0 and drop the translates; opacity changes may stay at 0ms.

## Today as the open page

Today is where the book lies open. On wide, a two-page spread: the left page is where you are
(`leftOffAt`: chapter title, rung, the goal sentence, the evidence sentence, one primary
`continueReading`), the right page is today's work as a short list under `Today`: reviews due
(deck title, count) and one drill (`oneDrill`, with `weakestIn` when there is a reason). No
cards, a vertical hairline between the pages. On narrow the left page stacks above the right.
With no book chosen, Today is the catalog, which becomes a shelf: one line per Book with its
glyph at `--text-2xl`, title, tagline and state, not two cards floating on an empty page.
Chapters opened by override list under the right page as `opened`, with `relock` as text links.

## Magic: three devices

1. **The bookmark.** A ribbon (a 10px wide accent tab hanging from the rail's top edge into
   the current rung's line, `clip-path` for the notch) marks where you stopped. Today opens on
   it. Data already exists: `progress.markRung` and `firstUnfinishedRung`.
2. **Rule echo.** On a wrong answer, the prose page named by the rule gets a soft wash
   (`color-mix(in srgb, var(--accent) 8%, transparent)`) for 2 seconds on wide, and the
   feedback panel quotes it on narrow. The book answers back from its own text.
3. **Margin ticks.** An exercise marker that has been passed shows a small pencil-grey `✓` in
   the left margin of the prose, so re-reading a chapter shows what you have already earned
   where you earned it. Reads `progress.exerciseState`, nothing new stored.

## Splitting `js/render.js`

`render.js` is 499 lines and this adds a rail, a facing page and a feedback panel. Split first:

| File | Owns | Est. |
|---|---|---|
| `js/render.js` | `render()`, `VIEWS`, `token`, fallback note, `destroyMounted` | ~90 |
| `js/views/shared.js` | `badge`, `action`, `link`, `evidenceLine` (replaces `meter`), `errorCard`, `attribution` | ~110 |
| `js/views/pages.js` | `pageNode`, `tableNode`, `figureNode` | ~100 |
| `js/views/chapter.js` | `chapterView`, `rungNode`, exercise marker | ~130 |
| `js/views/contents.js` | `catalogView` (shelf), `bookView`, `trackPicker`, `ladderRow` | ~130 |
| `js/views/rail.js` | the rail, the page bar, the bookmark (new) | ~120 |
| `js/views/open-page.js` | `todayView` as the spread (composer stays `js/today.js`) | ~100 |
| `js/views/settings.js` | `settingsView` | ~50 |
| `js/mount.js` | `startExercise`, the `mounted` map, host selection (prose vs `#facing`) | ~90 |

`js/events.js` gains `close-exercise` and `toggle-contents`. `js/app.js` stays at 19 lines.
The keycap and feedback work lands in `js/exercises/ask.js` (keycaps, numeral rule, digit
mapping), `js/exercises/types/choice.js`, `js/exercises/types/match.js` (`reveal`, status
above board) and a new `js/exercises/feedback.js` (the panel, the field lookup), each under
500. `quiz.js`, `quiz-host.js`, `spec.js`, `tools/`, `llms.txt`, `CLAUDE.md` and `books/**`
are untouched here; the field names above are the request to their owners.

## New strings

Shell, `js/i18n.js` `UI`:
`contents` { en: 'Contents', es: 'Índice' } · `chapterOf` { en: 'Chapter {at} of {total}', es:
'Capítulo {at} de {total}' } · `pageOf` { en: 'Page {at} of {total}', es: 'Página {at} de
{total}' } · `tryIt` { en: 'Try it', es: 'Pruébalo' } · `running` { en: 'Running', es: 'En
curso' } · `earned` { en: 'Done · {pct}', es: 'Hecho · {pct}' } · `passesAt` { en: 'Passes at
{pct} over {n} answers.', es: 'Se supera con {pct} en {n} respuestas.' } · `soFar` { en: 'So
far: {right} of {graded} right.', es: 'Hasta ahora: {right} de {graded} correctas.' } ·
`noneYet` { en: 'Nothing answered yet.', es: 'Todavía no hay respuestas.' } · `leftOffAt` {
en: 'You left off at', es: 'Te quedaste en' } · `continueReading` { en: 'Continue reading',
es: 'Seguir leyendo' } · `oneDrill` { en: 'One drill', es: 'Un ejercicio' } · `weakestIn` {
en: 'Your weakest skill, {skill} at {pct}', es: 'Tu habilidad más débil, {skill} al {pct}' }
· `shelf` { en: 'On the shelf', es: 'En el estante' } · `closeExercise` { en: 'Close', es:
'Cerrar' } · `stateGlyph` { en: 'State: {state}', es: 'Estado: {state}' }.

Engine, `js/exercises/strings.js`:
`question` { en: 'Question {at} of {total}', es: 'Pregunta {at} de {total}' } · `keyHint` {
en: 'Press the number beside an option, or the number itself when the options are numbers.',
es: 'Pulsa el número junto a una opción, o el número mismo cuando las opciones son números.' }
· `rightAnswer` { en: 'The answer', es: 'La respuesta' } · `because` { en: 'Because', es:
'Porque' } · `notThis` { en: 'Not {wrong}, which is easy to confuse with it.', es: 'No
{wrong}, que se confunde fácilmente con ella.' } · `seeRule` { en: 'See the rule in the
chapter', es: 'Ver la regla en el capítulo' } · `bothRight` { en: 'Both spellings are right;
the dictionary lists both.', es: 'Las dos grafías son correctas; el diccionario recoge
ambas.' } · `promptColumn` { en: 'Prompts', es: 'Enunciados' } · `answerColumn` { en:
'Answers', es: 'Respuestas' } · `paired` { en: 'Paired', es: 'Emparejados' } · `pairedAs` {
en: '{left}: {right}. {reveal}', es: '{left}: {right}. {reveal}' }.
