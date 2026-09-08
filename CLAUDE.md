# CLAUDE.md: Runcible

A learning book that grades you. Books are data packages under `books/<id>/`
(a manifest, chapters made of rungs, pages and exercise specs); the shell
provides ten generic exercise types, evidence-based chapter unlocking with a
visible override, a Today view, and a `{en,es}` reader. Two Books ship, both
`ready`: Japanese, fifteen chapters, and Piano, four, which is what proves the
shell knows no subject. Rappel decks and Quiz rounds are embedded by iframe.
Progress is local-first; Convex sync is dormant until a Clerk key is on the
page.

**Live:** runcible.neorgon.com · **Port:** 8878

## Run

```bash
make serve       # http://localhost:8878, scripts/serve.py with no-cache and CORS
make validate    # check-licence, validate-book, shell rules, validate-corpus, validate-phrases
npm test         # the Convex merge rules under plain node, no deployment
```

It must be served over HTTP. The app is ES modules and `file://` blocks them.
A `deck` exercise on localhost embeds `http://localhost:8879` and a `quiz`
exercise embeds `http://localhost:8880`, so serve `projects/rappel-site/` and
`projects/quiz-site/` as well to see one of each.

`make validate` is the definition of done for any change under `books/` or
`data/`. It is not in the root `make smoke`; nothing runs it for you. The
engine's own rig is `/js/exercises/fixtures/harness.html`.

## Architecture

| Module | Lines | Owns |
|---|---:|---|
| `js/misses.js` | 498 | MISS_CAP, DECK_FIELDS, TEMPLATE_ID, MISSES_EXERCISE_ID, missesDeckId, and more |
| `js/quiz-host.js` | 361 | PROTOCOL_VERSION, GAMES, quizOrigin, quizUrl, acceptable, and more |
| `js/render-today.js` | 353 | todayView |
| `js/sync.js` | 345 | syncAvailable, initSync, pull, push, pushBatch, and more |
| `js/state.js` | 344 | PREFS_KEY, PROGRESS_KEY, EVIDENCE_CAP, state, loadSaved, and more |
| `js/books.js` | 335 | CATALOG_SRC, LoadError, loadCatalog, openBook, declaredEntry, and more |
| `js/exercises/feedback.js` | 318 | explainWrong, explainRight |
| `js/exercises/items.js` | 311 | useLanguage, itemLanguage, stableValue, resolveList, shuffle, and more |
| `js/progress.js` | 297 | recordAttempt, attemptsFor, evidenceStatus, requiresFor, currentTrack, and more |
| `js/exercises/fixtures/harness.js` | 292 | none |
| `js/i18n.js` | 282 | LANGS, beginPage, hadFallback, onFallback, t, and more |
| `js/embed.js` | 274 | rappelOrigin, deckUrl, mountDeckEmbed |
| `js/exercises/types/match.js` | 272 | mount |
| `js/exercises/spec.js` | 252 | PERSONAL_DECK_PREFIX, DECK_FORMAT, GENERIC_TYPES, REQUIRED_FIELDS, NEVER_GRADED, and more |
| `js/exercises/speech.js` | 240 | synthAvailable, loadVoices, voicesFor, hasVoiceFor, speak, and more |
| `js/exercises/session.js` | 238 | createSession |
| `js/exercises/registry.js` | 233 | EXERCISE_VERSION, createExerciseRegistry |
| `js/render-chapter.js` | 229 | chapterView, drillRow |
| `js/render-mount.js` | 211 | setRepaint, setPending, scrollToId, destroyMounted, startExercise, and more |
| `js/exercises/types/typed.js` | 208 | askTyped, mount |
| `js/exercises/strings.js` | 188 | STRINGS, chrome |
| `js/exercises/types/order.js` | 188 | mount |
| `js/exercises/ask.js` | 174 | questionFrame, advance, optionList, roving, digitPicker |
| `js/events.js` | 149 | bindEvents |
| `js/exercises/types/listen.js` | 144 | mount |
| `js/render-pages.js` | 143 | pageNode, linksNode, tableNode, figureNode |
| `js/exercises/types/choice.js` | 123 | askChoice, mount |
| `js/today.js` | 122 | composeToday, firstUnfinishedRung |
| `js/exercises/types/speak.js` | 117 | mount |
| `js/exercises/fixtures/book-module.js` | 111 | PROVIDES |
| `js/exercises/types/page.js` | 109 | renderPage |
| `js/render-shared.js` | 105 | action, link, textLink, textAction, stateGlyph, and more |
| `js/render-contents.js` | 96 | catalogView, trackPicker, bookView |
| `js/exercises/types/read.js` | 94 | mount |
| `js/exercises/compare.js` | 93 | DEFAULT_COMPARE, COMPARE_TOKENS, parseCompare, normalise, isCorrect |
| `js/exercises/types/quiz.js` | 91 | mount |
| `js/exercises/dom.js` | 89 | el, append, button, clear, focus, and more |
| `js/render-rail.js` | 88 | railNode |
| `js/utils.js` | 87 | h, append, clear, showToast, debounce, and more |
| `js/render.js` | 85 | render |
| `js/exercises/types/deck.js` | 79 | mount |
| `js/exercises/errors.js` | 54 | locate, ExerciseError |
| `js/router.js` | 53 | ROUTES, href, parse, go, start |
| `js/render-settings.js` | 52 | settingsView |
| `js/exercises/bilingual.js` | 34 | paragraphs |
| `js/exercises/index.js` | 33 | none |
| `js/exercises/types/custom.js` | 23 | mountWith |
| `js/app.js` | 19 | none |
| the six vendored files below | 3645 | none, and never edited here |

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
- `books/`: `index.json` (neo-book-index/1), `japanese/` (15 ready chapters, none planned, 7 modules, 8 decks, 28 sets, 89 declared data files), `piano/` (4 ready, 1 planned, 1 module, 8 declared data files)
- `data/`: 61 JSON files, every one opening with a `_licence` block, plus `data/README.md`, the corpus contract; the format spec for authoring a Book is `llms.txt`
- The Japanese ladder is not the file order. `13-writing-system` sits after `2-katakana` and `14-phrases` after `4-first-words`, because array order in `book.json` is display order and the numbers are only ids

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
yours the same way; never edit another workstream's line. Five targets run
today: `validate-licence`, `validate-books`, `validate-shell`,
`validate-corpus` and `validate-phrases`. **Two warnings are the accepted
baseline**, down from five when the three Piano chapters gained evidence:
`8-study-plan` has no `goal.evidence` on purpose (nothing requires it, and its
first rung says it cannot be passed), and `e-deck-sentences` feeds another
chapter's skill (see the first Gotcha). A third warning is a regression.

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

**An item field may be bilingual, and `itemId` may not.** Every field named by
`prompt`, `answer`, `left`, `right`, `speak`, `expect` or `sequence`, plus a
grouping field and an explicit `distractors.values` entry, takes a plain string
or an `{en, es}` object and resolves to the reader's language. One accessor
does it, `fieldValue` in `js/exercises/items.js`, which is why every one of
those fields is bilingual at once; `sequence` may hold a list per language, and
a `typed` answer is graded against the language on screen. The language comes
from `api.lang` the first time a type resolves its list (`useLanguage`), and
`api.t` is called after that only to count a fallback, so a cue with no Spanish
lights the same honesty line a paragraph with no Spanish does. **What is stored
carries no language**: `itemId` resolves a bilingual field to its English side
whatever is being read (`stableValue`), so two sessions write one row for one
item, which C2.6 requires of progress already on disk. Until 2026-09-08 an
`{en, es}` here mounted a blank prompt with no error anywhere, which is why
`books/japanese/chapters/11-conversation.json` still writes
`prompt: "situation.en"`: that names the English side of a bilingual object and
shows English to everyone, where `prompt: "situation"` now shows a reader their
own language. Undo it when that chapter is next open.

**A `table` page's cells resolve the way its headers do.** `js/render-pages.js`
sends every cell through `cellText`, so a cell holding an `{en, es}` object
prints the reader's language instead of `[object Object]`. It used to be
`String(cell)`, which is why `data/phrases/ch14.json` carries `kana`, `en` and
`es` as three separate string columns showing both languages to everyone, and
why the Piano phase table became a prose page. Both can go back to one
bilingual column.

**A content page carries links in `links[]`, and nowhere else.** Any page kind
may take `links: [{ href, label, note? }]`, rendered by `linksNode` as a list
after the body and the table, each anchor `target="_blank"` with
`rel="noopener noreferrer"` and the site's own `.rn-textlink` styling. **https
only**: `tools/lib/page-links.mjs` refuses every other scheme at build time and
the renderer refuses it again at paint time, naming the link on the page rather
than dropping it, because chapter content is authored by a skill. A label is
required. Prose is still text: a URL inside a `body` string is a string, and
the 34 URLs sitting in callout bodies in chapters 9 to 14 (NHK's two lesson
indexes, Tadoku, Aozora, the Mutopia MIDI paths) are the ones to move. **A page
inside a `read` exercise does not draw them**: that surface is
`js/exercises/types/page.js`, which renders C3.3 pages inside an exercise host
and has no `links` branch, so a citation belongs on a rung page.
Related, and a licence rule rather than a shell one: **NHK, Tadoku, Tofugu,
musictheory.net and IMSLP are link-only.** No page of theirs is fetched by any
script here (NHK's `robots.txt` disallows `ClaudeBot`) and not one string of
theirs is copied.

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

### Your misses: the deck this site builds and sends

`js/misses.js` turns wrong answers into a `personal:runcible:<bookId>` deck,
`js/render-today.js` draws it on Today under Reviews due, and `js/embed.js`
posts it to the engine with `rappel:load` (CONTRACTS C12 A19; the format is in
`llms.txt` and in `projects/rappel-site/llms.txt`). Five things that are easy to
break:

- **A note id is `m_` plus 12 hex of SHA-256 of the miss key, and nothing else.**
  Not the order, not the language, not the day. A note id that moves restarts
  the learner's scheduling on every rebuild, which is exactly the `#d=` failure
  A19 exists to avoid.
- **The version moves only when the built content moves.** `slot.misses`
  (`{ date, n, sig }` in the progress store) holds the signature of the last
  document sent. Bumping it on every build makes the engine replace the deck
  several times a day for nothing; never bumping it leaves a stale deck on
  screen, because the engine ignores an equal or older version.
- **The rows come from the evidence windows, not from an index of their own.**
  DESIGN-MISSES.md specifies `slot.misses` written by `recordAttempt`; this
  build derives the same rows from `slot.evidence`, so the horizon is the
  C8.2 window of 200 attempts per skill rather than 200 misses. If
  `js/progress.js` ever grows the index, `gatherMisses` is the one function to
  replace.
- **A card's licence travels with it.** The deck carries the strictest licence
  of the sets and data files its cards draw from, and Today renders the same
  acknowledgement. A card built from a CC-BY set with no wording is refused by
  Rappel's validator, which is the gate that keeps a breach from shipping.
- **The answer comes home through the index, not through the spec.**
  `rappel:answer` carries `deckId:noteId`; the host maps the note id back to
  the row and records the miss's own item, skill, chapter and exercise. A note
  id the index does not know is said out loud and recorded nowhere, never
  guessed at.

Proof lives in `js/exercises/fixtures/misses/`: two progress stores built over
the real Book, run through **Rappel's own** `tools/validate-deck.mjs`, in
`npm test`.

## Do not touch

- `js/neorgon-*.js`, `js/vendor/neorgon-auth.js` and `css/neorgon-*.css`: vendored kits, regenerated by `packages/neorgon-ui/sync-*.sh`.
- `js/vendor/wanakana.js`: upstream, refreshed by `node tools/vendor-wanakana.mjs` after changing the pin in `tools/lib/sources.mjs`.
- `convex/_generated/`: rebuilt by `npx convex dev`.
- `data/**` and `books/japanese/decks/*.json`: emitted by `tools/build-*.mjs` from pinned upstreams, or hand-verified from Unicode names. Rebuild, do not hand edit; every output is committed so a bad run is `git checkout`.
  **The four decks the campaign shipped first are the exception, and it is flagged in the data rather than remembered.** `jp-first-words`, `jp-grammar-words`, `jp-kanji-grade1` and `jp-sentences-basic` were corrected by hand in commit `5124bee` and `build-decks.mjs` was never taught the three corrections, so a plain regeneration would silently undo a teacher's work. `held: true` on their `tools/selection/decks.json` rows makes the file under `books/` the document: the generator copies it to Rappel and counts its catalog row from it. Folding those corrections into the generator and dropping the flag is the real fix and it is a content decision.
- `favicon.*`, `apple-touch-icon.png`, `web-app-manifest-*.png`, `site.webmanifest`: generated by `packages/neorgon-ui/sync-favicon.sh` from this site's hub card.
