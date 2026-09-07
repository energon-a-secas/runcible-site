# The Runcible exercise engine

Contract **C2**, version `runcible-exercise/1`. Workstream **A1b**.
Everything under `js/exercises/` is this engine. Nothing else in the project is.

## What the shell imports

`js/exercises/index.js`, and nothing else under this directory.

```js
import { createExerciseRegistry } from './exercises/index.js';

const engine = createExerciseRegistry();          // one per page
engine.registerBookModule({ bookId, path, register, provides });
const handle = engine.mount(host, spec, api, { bookId, chapterId, rungId });
handle.destroy();
```

| Member | Does |
|---|---|
| `version` | `runcible-exercise/1` |
| `types` | the nine generic type names, in C2.1 order |
| `mount(host, spec, api, ctx)` | render one exercise, returns `{ destroy() }` |
| `registerBookModule({bookId, path, register, provides})` | run a Book module's default export against a frozen `runcible` object and hold it to `provides` |
| `registerExercise(id, impl)` / `registerTransform(id, fn)` | register outside a Book scope |
| `resetBook(bookId)` / `reset()` | drop registrations when the Book changes |
| `hasExercise(id)` | can this engine mount this type or module id |
| `getTransform(id)` / `listTransforms()` / `listExercises()` | what is registered |
| `validateSpec(spec)` | problems in one spec, as strings |

`index.js` also exports `validateExerciseSpec`, `checkRegisteredId`, `GENERIC_TYPES`
and `REQUIRED_FIELDS` for `tools/validate-book.mjs`, the compare pipeline for a
Book that wants to grade a string the way the generic types do, and the speech
helpers. **The whole module graph imports under node with no DOM**, so the
command line validator can use it.

## What `mount` needs from the shell

`api` is C2.3's frozen object: `attempt`, `t`, `lang`, `data`, `tts`, `done`.

- **`api.data(pointer)`** takes a whole C3.2 pointer, `"<path>#<dotted.path>"`,
  and returns the resolved value. The engine never parses a pointer: C3.2 puts
  that resolver in the shell and two resolvers for one syntax is two ideas of a
  valid pointer. May return a promise.
- **`api.t(obj)`** resolves a scalar `{en,es}`. It cannot resolve a list valued
  body, so `read` resolves those itself from `api.lang` (see `bilingual.js`).
- **`api.tts(text, opts)`** is what `listen` and `speak` speak through, so the
  Book's content language applies. `speech.js` exports `tts` as the body to use.
- **`api.attempt(a)`** is called directly and is never wrapped. A throw from the
  recorder is a bug in the recorder, and a chapter that silently never unlocks
  is the worst failure this design has.
- **`api.done(summary)`** is called from the summary panel's Continue button,
  not the instant the last item is answered, so the learner sees the result. The
  summary argument is extra information and may be ignored.

`ctx` is `{ bookId, chapterId, rungId }`. It is only used to name a chapter in a
load error, which C2.4 requires, and is passed through untouched to the deck
host.

## The nine types, and what a chapter spec gives each

Every spec carries `id`, `type` and `skill`. `skill` is required by C2.3.
Optional on any type: `count` (how many items to ask, default all),
`pass: { accuracy }` (the tick beside the exercise, never the chapter gate),
`itemIdPrefix`, `itemIdField`, `compare`.

| `type` | Fields | Notes |
|---|---|---|
| `read` | `pages[]` | whole C3.3 page objects, not page ids. One `correct: null` attempt per page, `ms` is the dwell |
| `choice` | `items`, `prompt`, `answer`, `distractors` | `distractors: { n, by?, values? }`. `by` names a grouping field so distractors come from siblings |
| `typed` | `items`, `prompt`, `answer`, `transform?`, `compare?` | the transform runs on every keystroke and rewrites the input |
| `match` | `items`, `left`, `right`, `n`, `reveal?` | one attempt per pairing action, keyed on the left item. `reveal` names a field shown only once a pair locks, so the answer column can carry the answer alone |
| `order` | `items`, `sequence`, `prompt?` | `sequence` names a field holding an array, or a string split on whitespace |
| `listen` | `items`, `speak`, `answer`, `respond`, `lang` | `respond` is `choice` or `typed`. See the degrade rules below |
| `speak` | `items`, `expect`, `lang` | `correct: null` always. There is no branch in that file that can produce true or false |
| `deck` | `src`, `limit?`, `mode?` | delegated to `js/embed.js`'s `mountDeckEmbed({host, spec, api, ctx})` |
| `custom` | `module`, `props?` | `module` is a registered id. `{ "type": "jp.loanword" }` is refused: a Book module is used as `{ "type": "custom", "module": "jp.loanword" }` |

**`itemId`** (C2.3) is resolved in this order, and C2 does not say where it comes
from, so it is stated here:

1. `item.id`, prefixed by `itemIdPrefix`
2. the field named by `itemIdField`
3. the value of the type's identity field (the prompt, the spoken field, and so on)
4. the exercise id plus a position, which is **not** stable across a data edit
   and warns on the console once

**Give items an `id`.** Only rule 1 gives the same `itemId` when the same thing
is tested in both directions, and cross-direction identity is what makes weak
item resurfacing mean anything.

## What a wrong answer says, and where it reads it

Every graded type shows a panel under the verdict: what was chosen, struck;
what was expected; and one sentence of why. The engine reads field names and
never interprets a value, so the sentence is as good as the content behind it.
Sources, in the order the engine tries them:

| Source | Shape | Where it goes |
|---|---|---|
| `item.explain` | `{en,es}` or a string | the sentence, as authored |
| `item.rule` / `item.rules` | a rule id, or a list of them | resolved against `ctx.chapter.rules` (when the shell passes a chapter), `ctx.rules`, `spec.rules`, then `spec.props.rules`. A rule row is `{ title, text, examples[] }` or `{ rule, examples_text }`, the shape `data/loanwords/rules.json` already has |
| `item.confusables`, `spec.confusables`, or a `confusables` fragment in the document `spec.items` came from | strings, or `{ glyphs[], tell }` rows | the row holding the prompt gives its `tell`, after `notThis` |
| the item pool | none, derived | "You picked ki, which is き", from the spec's own `prompt` and `answer` fields, and only when exactly one item carries the chosen answer |
| nothing | | the panel says so in one muted line, rather than leaving a reader to wonder whether it forgot |

A rule that names a `page` gets a link. The engine cannot reach the prose, so
the link dispatches `rx-see-rule` (`{ ruleId, pageId }`) on the exercise root
for the shell to handle; unhandled, it scrolls to `#page-<id>` or
`[data-page-id]` and marks it `data-rx-echo` for two seconds.

Content can start carrying `explain`, `rule`, `confusables`, `reveal` and page
ids before anything else changes: an absent field is a source the engine skips,
never an error.

## Options, keycaps and keys

An option row is `[keycap] [label]`, two elements. The number is never a prefix
inside the label: `1. 5` reads as part of the answer, which is what made a
beats drill look like it was asking about the numbers 1, 2 and 3.

- Text options get a `<kbd>` cap showing `1`..`9`, and the digit presses that row.
- When **every** option is a bare integer the cap would be a number beside a
  number, so it is dropped and the label becomes the key: square tiles, and
  pressing `5` picks the tile showing 5.
- A numeral set containing a value of more than one digit (`0 1 95 16`) keeps
  the tiles and loses the digit shortcut, because `1` cannot mean both `1` and
  the first press of `16`. Arrow keys and Enter still work, and the hint says so.

Arrow keys, Home and End walk every option list, the token bank and both
columns of a pairing board. After any repaint focus lands on the next control
or on the verdict, never on `body`.

## The two speech facts, C2.5

1. `getVoices()` is async on Chrome and returns an empty array until
   `voiceschanged` fires. `speech.js` never answers from one synchronous read.
   Measured: with a synthesis stub whose first read is empty and whose
   `voiceschanged` fires at 400 ms, `loadVoices()` resolves at 403 ms in Chrome,
   406 ms in Firefox and 401 ms in WebKit. With no voices and no event it
   resolves empty at about 1.5 s rather than hanging, which is how "after
   `voiceschanged`" becomes a moment a degrade decision can be taken at.
2. No voice for `spec.lang` after that:
   - the spoken field is **not** the answered field: degrade to text, and say so
     on the page
   - the spoken field **is** the answered field, or `audioOnly: true`: the only
     prompt is audio, so showing it hands over the answer. **Skip**, and record
     nothing. A skipped question is not a wrong one.

`speak` is never graded, on any browser, whatever the learner does. Where
`SpeechRecognition` exists the transcript is shown as the learner's own
feedback; where it does not, the exercise says so in one line. MDN and Apple's
own WebKit blog disagree about Safari, and caniuse and MDN disagree about Edge.
Two authorities disagreeing is not a foundation for a chapter gate.

## Rules the registry enforces

- a registered **exercise** id contains a dot, and its first dot separated
  segment is not a generic type name, so a Book cannot shadow `typed`
- a registered **transform** id is free form (C12 A10). The dot rule is a
  namespace rule for the nine generic types, and C2.4 ships no transforms for
  one to shadow, so `kana` and `kana-katakana` register as written
- a Book registers exactly what its `modules[].provides` declares: an
  undeclared registration and a declared-but-absent one are both refused (C1 rule 4)
- an unregistered `transform` id is a load error naming the chapter and the
  exercise (C2.4). **The shell ships no transforms.**
- `api.attempt` gets `correct` as `true`, `false` or `null`, and never anything else

## Running it

```
make serve P=runcible-site
open http://localhost:8878/js/exercises/fixtures/harness.html
```

`fixtures/` is the engine's own rig: a `neo-chapter/1` with one exercise of each
of the nine types plus two extra `listen` variants for the degrade and skip
paths, a Book module registering one transform and one custom exercise, and a
panel that runs the contract's refusals at boot. It stands in for the shell with
its own `api.data` and `api.t` and nothing else. Its content is about the solar
system on purpose: if the engine ever needs to know its topic, this fixture
stops working.

## What is not built here

- **Figures.** A `figure` page shows its caption and names itself. Drawing an
  `svg` figure means either putting markup from a data file into the page, which
  C3.3 forbids, or writing a second renderer for a notation `js/render.js` owns.
- **The Rappel embed.** `types/deck.js` calls `js/embed.js` and draws no frame of
  its own. One implementation of C6, and it is not in this directory.
