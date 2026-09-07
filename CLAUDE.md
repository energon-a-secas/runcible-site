# CLAUDE.md: Runcible

A learning book that grades you. Books are data packages under `books/<id>/`
(a manifest, chapters made of rungs, pages and exercise specs); the shell
provides nine generic exercise types, evidence-based chapter unlocking with a
visible override, a Today view, and a `{en,es}` reader. The first Book is
Japanese, the second a Piano stub that proves the shell knows no subject.
Rappel decks are embedded by iframe. Progress is local-first; Convex sync is
dormant until a Clerk key is on the page.

**Live:** runcible.neorgon.com · **Port:** 8878

## Run

```bash
make serve       # http://localhost:8878, scripts/serve.py with no-cache and CORS
make validate    # check-licence, validate-book, shell rules, validate-corpus
npm test         # the Convex merge rules under plain node, no deployment
```

It must be served over HTTP. The app is ES modules and `file://` blocks them.
A `deck` exercise on localhost embeds `http://localhost:8879`, so serve
`projects/rappel-site/` as well to see one.

`make validate` is the definition of done for any change under `books/` or
`data/`. It is not in the root `make smoke`; nothing runs it for you. The
engine's own rig is `/js/exercises/fixtures/harness.html`.

## Architecture

| Module | Lines | Owns |
|---|---:|---|
| `js/vendor/wanakana.js` | 1822 | none |
| `js/render.js` | 493 | `render`, `startExercise` |
| `js/sync.js` | 343 | `syncAvailable`, `initSync`, `pull`, `push`, `pushBatch` |
| `js/state.js` | 327 | `PREFS_KEY`, `PROGRESS_KEY`, `EVIDENCE_CAP`, `state`, `loadSaved` |
| `js/books.js` | 319 | `CATALOG_SRC`, `LoadError`, `loadCatalog`, `openBook`, `declaredEntry` |
| `js/progress.js` | 289 | `recordAttempt`, `attemptsFor`, `evidenceStatus`, `requiresFor`, `currentTrack` |
| `js/neorgon-beacon.js` | 263 | none |
| `js/exercises/fixtures/harness.js` | 247 | none |
| `js/exercises/speech.js` | 239 | `synthAvailable`, `loadVoices`, `voicesFor`, `hasVoiceFor`, `speak` |
| `js/exercises/registry.js` | 231 | `EXERCISE_VERSION`, `createExerciseRegistry` |
| `js/exercises/session.js` | 203 | `createSession` |
| `js/embed.js` | 200 | `rappelOrigin`, `deckUrl`, `mountDeckEmbed` |
| `js/vendor/neorgon-auth.js` | 167 | `initNeorgonClerkConvex`, `neorgonSignOut`, `neorgonDisplayLabel` |
| `js/exercises/items.js` | 165 | `resolveList`, `shuffle`, `pickItems`, `fieldValue`, `displayValue` |
| `js/exercises/types/typed.js` | 158 | `askTyped`, `mount` |
| `js/neorgon-persist.js` | 152 | `safeGet`, `safeSet`, `safeRemove`, `safeGetJSON`, `safeSetJSON` |
| `js/exercises/types/order.js` | 146 | `mount` |
| `js/exercises/spec.js` | 140 | `GENERIC_TYPES`, `REQUIRED_FIELDS`, `NEVER_GRADED`, `validateExerciseSpec`, `checkRegisteredId` |
| `js/i18n.js` | 138 | `LANGS`, `beginPage`, `hadFallback`, `t`, `tList` |
| `js/exercises/types/listen.js` | 134 | `mount` |
| `js/exercises/types/match.js` | 118 | `mount` |
| `js/exercises/types/speak.js` | 116 | `mount` |
| `js/exercises/fixtures/book-module.js` | 112 | `PROVIDES` |
| `js/today.js` | 111 | `composeToday`, `firstUnfinishedRung` |
| `js/exercises/types/choice.js` | 111 | `askChoice`, `mount` |
| `js/exercises/types/page.js` | 109 | `renderPage` |
| `js/exercises/compare.js` | 94 | `DEFAULT_COMPARE`, `COMPARE_TOKENS`, `parseCompare`, `normalise`, `isCorrect` |
| `js/exercises/types/read.js` | 93 | `mount` |
| `js/events.js` | 92 | `bindEvents` |
| `js/exercises/dom.js` | 90 | `el`, `append`, `button`, `clear`, `focus` |
| `js/utils.js` | 88 | `h`, `append`, `clear`, `showToast`, `debounce` |
| `js/exercises/types/deck.js` | 77 | `mount` |
| `js/exercises/ask.js` | 57 | `questionFrame`, `advance`, `digitPicker` |
| `js/exercises/errors.js` | 55 | `locate`, `ExerciseError` |
| `js/router.js` | 54 | `ROUTES`, `href`, `parse`, `go`, `start` |
| `js/exercises/bilingual.js` | 35 | `paragraphs` |
| `js/exercises/index.js` | 31 | none |
| `js/exercises/types/custom.js` | 24 | `mountWith` |
| `js/app.js` | 20 | none |

Import direction, which the contracts freeze: the shell imports
`js/exercises/index.js` and nothing else under that directory; a Book module
never imports the engine, it receives a frozen `runcible` object with exactly
`registerExercise`, `registerTransform` and `version`; `js/embed.js` is the one
implementation of the Rappel embed and `types/deck.js` hands it the host;
`js/sync.js` is workstream D's brokered surface and the shell imports it
without editing it (C7.8). `js/books.js` imports `tools/validate-book.mjs` in
the browser, so the CLI validator and the load-time check are one module.

Vendored from `packages/neorgon-ui/`, never edited in place, refreshed by the
sync scripts: `js/neorgon-header.js`, `js/neorgon-footer.js`,
`js/neorgon-beacon.js`, `js/neorgon-persist.js`, `js/vendor/neorgon-auth.js`
and the matching `css/neorgon-*.css`. `js/vendor/wanakana.js` is upstream
5.3.1 with a licence header, refreshed by `node tools/vendor-wanakana.mjs`.

## Data

- `localStorage['runcible:prefs:v1']`: `{ lang, track, bookId, reduceMotion, ttsVoice, seenIntro }`, via the Persist kit, `version` 1
- `localStorage['runcible:progress:v1']`: `{ books: { <bookId>: { chapters, evidence, decks } } }`, evidence windows capped at 200 attempts per skill
- `localStorage['runcible:lyrics:v1']`: owned by the Japanese Book's `jp.lyrics` module, never synced, never put in a URL. The Convex schema has no table for it on purpose
- Convex tables: `evidence`, `prefs`, `progress` (see `convex/schema.ts`). Dev deployment `knowing-pheasant-276`, public URL in `js/sync.js`
- `books/`: `index.json` (neo-book-index/1), `japanese/` (9 ready chapters, 4 planned, 6 modules, 4 decks, 41 declared data files), `piano/` (3 ready, 2 planned, no modules, no data)
- `data/`: 37 JSON files, every one opening with a `_licence` block, plus `data/README.md`, the corpus contract; the format spec for authoring a Book is `llms.txt`

## Conventions

- Zero build step. Plain ES modules loaded by `js/app.js`. No bundler, no npm dependency for the app; `convex` is the only dependency and only the backend uses it.
- Header and footer come from the shared kits. Do not add site-local `.neo-footer` or `.header-bar` CSS.
- No authored JS module over 500 lines, `js/app.js` under 50, no inline `onclick`, no JSON file over 150 KB. `make validate-shell` checks all four; `wanakana.js` and the kits are excluded from the count and are not to be split.
- Nothing under `js/` may name a subject. `grep -rni piano js/` is empty and stays empty. The `kana` compare token is a Unicode block fold, argued in `compare.js` as the same class of operation as `strip-accents`.
- Content reaches the page as text nodes only. `h()` throws on any attribute starting with `on`, there is no `innerHTML` and no `escHtml`, and the validator refuses inline HTML in any content field.
- The only identity knob is `--accent: #e11d48` plus `--accent-bright` in `css/style.css`. A Book may not set a colour; `validate-book` refuses `accent`.
- No em dashes, and none of the five marketing words the root CLAUDE.md bans. `validate-corpus` checks string values inside every JSON file for the dash.

## Gotchas

**A deck's attempts are recorded under the spec's `skill`, not the engine's.**
QA on 2026-09-04 found all four `deck` exercises feeding a skill no goal read:
`embed.js` recorded `m.skill` from the deck template
(`vocab.first-words.read`) while the chapter goal wanted `jp.vocab.read`, so a
learner reviewed and the counter stayed at zero with no error anywhere.
`js/embed.js` now records `spec.skill || m.skill`, and `validate-book` fails a
deck whose skill no goal or non-deck exercise in the Book reads. It only warns
when the skill belongs to another chapter, which is why `e-deck-sentences`
(feeds `jp.reading.sentence`, chapter 7 wants `jp.listening.pick`) prints a
warning today rather than an error. That is a chapter authoring choice still
open, not a validator gap.

**Evidence rows sent to Convex are deltas, never running totals (C12 A1).**
The server sums `attempts` and `correct` whenever its row is older, so a
lifetime total pushed twice is counted twice, `goal.evidence` passes chapters
nobody earned, and nothing reports it. Evidence leaves `state.js` by exactly
one route, `flushEvidence()` feeding `pushBatch()` from `_unpushed`, and the
batch is taken out of the queue synchronously before the first `await` so two
overlapping flushes hold disjoint sets. No `push()` document assembled in
`state.js` carries an evidence array. Keep it that way. This path is also
unexercised end to end: no sign-in exists yet, so `TEST-REPORT.md` section 6
lists it as the most dangerous untested item in the campaign.

**The evidence window on the wire is 0/1 flags, and `mergeRemote` rebuilds
records from them (C12 A18).** `sync.js` sends one flag per attempt in the
batch; `convex/merge.ts` appends them to the stored window and keeps the newest
200; `state.js` turns each flag into `{ at, itemId: null, skill, correct, ms: 0,
source: 'sync' }`. Before 2026-09-04 the server replaced the window with the
batch and the client adopted raw numbers as records, so a chapter passed on
one device read as locked on the next, with no error. `weakItems` skips
records with no `itemId`; the gate reads only `correct`. `npm test` runs
`convex/merge.test.ts`, which asserts the rolling window.

**`pull()` and `push()` are scoped by `initSync({ bookId })`, not by their own
arguments (C12 A2).** Unscoped they return `null` and
`{ ok: false, error: 'no-book-scope' }`. `openBook()` is the one place a Book
becomes the open Book and the one place `setPref('bookId')` runs, which is what
re-scopes sync. The book view used to set the pref, which left a deep link
straight into a chapter unscoped and therefore unsynced.

**A transform has two halves, and the kana grader needs both (C12 A16, A17).**
The live function runs per keystroke and must leave a trailing `n` alone,
because `na` may still be coming; `transform.settle(value)` runs once at submit
in `types/typed.js`, before `compare`. Without settle, `shinbun` graded wrong as
しんぶn; with wanakana's `IMEMode` as the live half, `onna` lands as おんあ
and no settle can recover it because the romaji is gone. `kanaReader()` in
`books/japanese/exercises/kana-input.js` is the measured answer, and Rappel
carries a copy of the same eleven lines rather than an import, because the two
origins share no code. Do not copy C2.2's `IMEMode: true` example into a grader.

**Exercise ids need a dot; transform ids do not (C12 A10).** `checkRegisteredId`
refuses an exercise id whose first dot-separated segment is a generic type, so a
Book cannot shadow `typed`. Applying that rule to transforms refused the
contract's own `"transforms": ["kana", "kana-katakana"]`; `checkTransformId`
only asks that the string is non-empty.

**A Book registers exactly what `modules[].provides` lists.** The registry
refuses an undeclared registration and a declared-but-absent one
(`assertComplete`). A chapter's `{ "type": "jp.loanword" }` is refused too; a
Book module is used as `{ "type": "custom", "module": "jp.loanword" }`.

**`data[]` in the manifest is a permission list.** The shell resolves a pointer
only if its path is declared there, and a deck `src` needs the declaration as
well even though the engine, not the shell, fetches it. An undeclared path is a
`LoadError` naming `book.json`. The acknowledgement block is the union of the
manifest entry and the file's own `_licence.screen`, so a manifest can never
suppress an acknowledgement the file requires; `validate-book` names the
disagreement so it does not over-credit forever.

**The chapter goal lives in the chapter file, so the ladder loads every
chapter file, and nothing else.** `loadLadder()` calls
`loadChapter(book, id, { data: false })` for all of them (they are small)
before `progress.ladder()` can say what is passed or locked; the corpus slices
a chapter declares wait until it opens, when the default `loadChapter()` fills
them in. Until 2026-09-04 the ladder loaded the data too, 420 KB on every Today
view against C11.6's 40 KB eager budget, and the comment above it said
otherwise. A required chapter whose file fails to load keeps its dependents
locked (`progress.chapterState`): a fetch failure must not read as "nothing to
pass".

**`requires` is read from the manifest entry, not the chapter file.**
`progress.requiresFor(book, entry)` walks `book.chapters[]`. The `requires` and
`state` keys chapter files also carry are documentation; `validate-book` warns
when a chapter file's `requires` disagrees with the manifest entry. Chapters 0 to 2 must use the array form; the per-track object form
must name every declared track or `requiresFor` throws a load error.

**`correct: null` attempts do not occupy window slots.** `evidenceStatus`
filters to graded attempts before taking the last `window`, so re-reading pages
can never push earned evidence out of the window. The contract sentence admits
both readings; this is the humane one, and it is recorded in the function's
comment.

**A locked gate opens by hand and never cascades.** `override: true` makes a
chapter `available`, never `passed`, so a chapter that requires it stays locked
until real evidence arrives. The Today view lists the overrides and offers
re-lock.

**The iframe is `loading="lazy"`, which a short headless viewport never
triggers.** QA's first embed run recorded zero messages and nearly filed the
integration as broken; the frame had not entered the viewport. Scroll it into
view, or use a 1440x1200 viewport. The host also times silence: after 8 s with
no message it says so and points at the "Open in Rappel" link, which
`render.js` draws beside every deck whether or not a frame mounted.

**The embed origin is `localhost:8879` whenever the host is on localhost.**
`rappelOrigin()` is not a fallback: the deck fetch then crosses origins, and it
works only because `scripts/serve.py` sends `Access-Control-Allow-Origin`.
Plain `python3 -m http.server` will serve the site and break every deck.

**`speak` never grades, `listen` skips rather than leaks.** `types/speak.js`
has no branch that produces true or false: Safari and Edge support for
`SpeechRecognition` is disputed between MDN, Apple and caniuse, so it is never a
gate. `listen` waits for `voiceschanged` (`getVoices()` is empty on Chrome
until then) and, with no voice for `spec.lang`, shows the text unless the spoken
field is the answered field or `audioOnly: true`, in which case it skips and
records nothing. `spec.lang` is filled in from `book.lang.content` by
`render.startExercise` when the exercise does not state one.

**`distractors` reads `n`, `by` and `values`. `from` is ignored.** The
contract's worked example says `{ "from": "siblings", "n": 3 }`; `items.js`
never reads `from`, and siblings are selected by the grouping field named in
`by`. All 55 shipped specs with `distractors` set `n`; two of them also give a
`values` list.

**svg figures draw geometry only (C12 A15).** `render.figureNode` accepts an
array of path strings, or `paths` / `s` on the record, with a viewBox from the
record, the file or the figure, and every other shape renders a visible "needs
path strings" line. A Book cannot register a figure renderer; the frozen API
has two calls. `types/page.js`, the reader inside an exercise host, draws no
figure at all and says so.

**The banned-song gate scans four directories and spells nothing.**
`tools/check-licence.mjs` greps `books/`, `data/`, `js/` and `tools/` for five
titles held as `\u` escapes (so it can scan itself), the two 1942 incipits of
the spring brook song, a `_licence` block on every `data/**/*.json`, verse
counts against `verses_permitted`, and exactly 19 song ids from a frozen list.
It does not scan `index.html`, `css/` or the project root; QA planted a title
in `index.html` and the checker passed. Never write the five titles in
Japanese anywhere, this file included. `data/README.md` names them by romaji.

**Never rename the storage keys.** `runcible:prefs:v1`, `runcible:progress:v1`
and the Book-owned `runcible:lyrics:v1` are frozen in C8.2 and spelled in
`state.js` and `lyrics.js` only. The `:v1` in the key is the format generation
(bumping it orphans data on purpose); the `version` argument to `createStore`
is the migration counter inside that generation.

**Sync is dormant, and the client import must stay dynamic.** With no
`<meta name="clerk-publishable-key">` an anonymous load issues zero requests to
esm.sh, convex.cloud or Clerk (measured, 51 requests, none off the fleet CDN).
`memes-site` imports the Convex client statically at module top and pays on
every visit; do not copy that. `pull()` runs before `push()` on sign-in inside
`sync.js`, because this repo once shipped a sync that pushed for months with
nothing reading back.

**The ledger lives on Rappel's origin and is same-site only.** Inside
`runcible.neorgon.com` the embed shares standalone Rappel's ledger; a
third-party host gets its own partition and Safari may partition even the
same-site case. The engine reports `ledger: "ephemeral"` when it cannot write
and `embed.js` shouts `notSaved` on the page. Do not drop that message.

**The routes are a hash, and an unknown hash is the catalog.** `#/b/<book>/<chapter>`
joins any further segments into the chapter id, so `#/b/japanese/../etc` is an
unknown chapter, not a traversal. A missing Book or chapter renders an error
that names `books/index.json` or `book.json`.

**`itemId` is stored progress. Give items an `id`.** `itemIdOf` falls back
through `itemIdPrefix` + `item.id`, `itemIdField`, the type's identity field,
and finally exercise id plus position, which moves when the data file is edited
and warns once on the console. Only rule 1 keeps the same id when the same
thing is tested in both directions, which is what weak-item resurfacing needs.

**`make validate` is composable and no target is rewritten.** Each validator is
its own `.PHONY` target plus a bare `validate: <target>` line (C12 A8). Add
yours the same way; never edit another workstream's line. Five warnings are the
accepted baseline: `8-study-plan` and the three Piano chapters have no
`goal.evidence` and can never be passed, and `e-deck-sentences` feeds another
chapter's skill (see the first Gotcha).

**What QA did not cover (TEST-REPORT section 6):** anything behind sign-in, a
successful `rappel:restore`, the `page` renderer inside a `read` exercise (no
Book uses a `read` with a figure), Safari, Firefox, audio output, the three
other deck embeds, a drill played to a real pass, `?ledger=host`, themes, and
the forge skills' output. Treat those paths as unproven rather than as working.

**Sync mounts at boot, before any Book is open.** `scopeSyncTo(null)` runs
`initSync` with no scope so the account button, when a key is present, opens a
mounted sheet rather than an empty one; `pull()` and `push()` refuse with
`no-book-scope` until a Book is chosen, and choosing one re-scopes the same
client. Clerk is mounted with `routing: 'virtual'` because `js/router.js` owns
`location.hash`.

**A custom module that never grades says so at registration.**
`registerExercise(id, { graded: false, mount })` is what keeps Today from
offering `jp.lyrics`, `jp.pitch` or `jp.namer` as the day's game or counting
them as drills (`engine().exerciseImpl(id)`); a module that omits the flag is
graded. A skipped or crashed exercise (`api.done({ skipped })`,
`api.done({ error })`) is not marked done.

### The second embed host: Quiz

`js/quiz-host.js` mirrors `js/embed.js` for quiz.neorgon.com and is wired through
`js/exercises/types/quiz.js`, the tenth generic type (`{ type: "quiz", game, src,
skill, limit? }`). Three rules that are easy to break: a quiz `src` is a path from
the site root (the same as a deck `src`) and must be declared in the manifest's
`data[]`, or the validator and the runtime both refuse it; the host records every
`quiz:answer` under the exercise spec's own `skill`, never the engine's, so the
chapter goal that reads that skill is the one fed; and `js/progress.js` accepts
only the sources `shell`, `rappel` and `quiz`, so a new host needs that enum
widened or every answer is refused with "An answer was not recorded". The sets
under `books/japanese/sets/` are generated by `tools/build-sets.mjs` and must stay
byte-identical to `projects/quiz-site/data/sets/`; never hand-edit either copy.

## Do not touch

- `js/neorgon-*.js`, `js/vendor/neorgon-auth.js` and `css/neorgon-*.css`: vendored kits, regenerated by `packages/neorgon-ui/sync-*.sh`.
- `js/vendor/wanakana.js`: upstream, refreshed by `node tools/vendor-wanakana.mjs` after changing the pin in `tools/lib/sources.mjs`.
- `convex/_generated/`: rebuilt by `npx convex dev`.
- `data/**` and `books/japanese/decks/*.json`: emitted by `tools/build-*.mjs` from pinned upstreams, or hand-verified from Unicode names. Rebuild, do not hand edit; every output is committed so a bad run is `git checkout`.
- `favicon.*`, `apple-touch-icon.png`, `web-app-manifest-*.png`, `site.webmanifest`: generated by `packages/neorgon-ui/sync-favicon.sh` from this site's hub card.
