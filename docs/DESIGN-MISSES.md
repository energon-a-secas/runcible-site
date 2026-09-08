# Your misses: a Quiz miss becomes a Rappel card

Design for the Book side of the misses bridge, 2026-09-08. The owner's sentence: a miss in a
Quiz round enters the Rappel deck of the following day; the evidence already travels, the
bridge is missing. Engine side: CONTRACTS.md C12 A19 (`rappel:load`, `personal:` decks) and
`rappel-site/llms.txt`. The Book never imports Rappel's JS; the coupling stays C6.

## Which attempts become cards

The progress store gains one index, `slot.misses`, keyed by miss key and written by
`recordAttempt` (`js/progress.js`, the only writer) whenever `correct === false`:

- a `quiz:answer` with `correct: false` (`source: 'quiz'`). `readAnswer` in `js/quiz-host.js`
  keeps `setId` from the message as an optional attempt field (C2.6: adding one is safe);
- a graded generic miss (`source: 'shell'`) whose item can be rebuilt from its chapter data:
  `choice`, `typed`, `listen` (prompt field, answer field) and `match` (left, right). `order`,
  `custom` and `speak` are skipped: no single prompt and answer to put on a card;
- never `source: 'rappel'`: that miss is already a card, in the deck that produced it.

Key: `miss:<source>:<setOrChapter>:<itemId>`, `setOrChapter` the `setId` for a quiz miss and
the `chapterId` for a generic one. A repeated miss merges into one row (`at` moves to the
newest, `n` counts). A later correct answer does not delete the row: the deck's scheduler is
the one who decides when it is learned. Row: `{ key, at, n, itemId, skill, chapterId,
exerciseId, source, setId }`. Cap: the newest 200 by `at`, oldest dropped at write. The index
is per device, like the engine's ledger; sync carries flags only (A18), so a miss made
elsewhere is not here, and the page does not pretend otherwise.

## How a card is built

Note id: `m_` plus the first 12 hex of SHA-256 of the key, because a note id may not hold a
colon or kana and a generic `itemId` can (`kana:か`). The key rides in a field. Fields:
`Front`, `Back`, `Why`, `From`, `Key`. One template, `recall`, kind `basic`, front `{{Front}}`,
back `{{Back}}<br>{{Why}}<br>{{From}}`. Each note carries `skill` (the miss's own), which C4
lets win over the template's. `From` is the set's `name` or the exercise's `title`.

| Source | Front | Back | Why |
|---|---|---|---|
| beats | `kana` | `beatsBack` with `beats` and `split` joined by `・` | the rule's `explain` |
| sound | `kana` | `soundBack` with `sound` and `row` as the set spells it | none |
| pairs | `left` | `right`, plus ` · ` and `note` when the item has one | none |
| order | `gloss` | `line` | none |
| generic | the prompt field as shown | the answer field | the item's `explain` |

Set items are looked up by `setId` through the chapter's exercise `src` (the file's own `id`
must match); generic items through `chapterId`, `exerciseId` and `itemIdOf`. Bilingual where
the source is: `{en, es}` values resolve to the reader's language at build, so a language
switch is a rebuild (note ids do not change, scheduling survives). An item that no longer
exists in its data is skipped this build, kept in the index, and counted on the console.

## The deck document

`id: personal:runcible:<bookId>`. `name: { en: 'Your misses', es: 'Tus fallos' }`. `lang:
{ front: 'ja', back: <reader lang> }`. `version: <YYYY-MM-DD of the newest miss>.<n>`, `n` a
per-book counter in the progress store, bumped only when the built content (note ids, field
values, language) differs from the last document sent. Licence travels with the card:
`licence` is the most restrictive `spdx` among the sets and chapter data the cards draw from
(share-alike wins over public domain), `screen: "required"` if any source requires it,
`attribution` the distinct required wordings joined with a space, `source` the first such URL.
No `media_base`. Validated with `tools/validate-deck.mjs` in a node test using two fixtures
(one all public domain, one mixed) before anything is sent.

## Where it lives on Today

`js/today.js` composes `plan.misses` from the index: the built document, its version, the
card count, and cached counts from `slot.decks['personal:runcible:<bookId>']`
(`noteDeckCounts` keyed by deck id in place of a `src`). `js/render-today.js` draws an item
titled `missesTitle` right after Reviews due, only when the deck has at least one card:

- a counts line from `rappel:due` like the other decks, `{due} due · {new} new`, or
  `missesCount` before the engine has ever reported;
- the first time (no cached counts yet): `missesLead`, then `missesCap`;
- the licence line, always, when `screen` is required (C11.3: on every screen that shows the
  data), as the Book's own `.neo-attrib`;
- Start (`open-misses`), which mounts the deck host in place with a synthetic spec
  `{ id: 'your-misses', type: 'deck', title, mode: 'review', load: <document> }`.

`js/embed.js` learns `spec.load`: the URL carries `deck=personal:runcible:<bookId>` instead
of `src`, `assertDeclared` is skipped (the document is not a manifest file), and on the
frame's `load` event the host posts `rappel:load { deck, store: 'engine' }` then
`rappel:hello`. Attribution per answer: the engine's `itemId` is `deckId:noteId`; the host
maps `noteId` back through the index to the row and records `{ itemId: row.itemId, skill:
row.skill }` with `{ chapterId: row.chapterId, exerciseId: row.exerciseId, source: 'rappel' }`,
so a review lands on the item and chapter that produced the miss. A `noteId` not in the
index is said out loud (`deckNoSkill` path) and not recorded. The escape link is
`?deck=personal:runcible:<bookId>` on the top-level origin, where the stored copy opens.

## Keeping it current

Rebuilt from the index at every Today paint (cheap: 200 rows, no fetch beyond cached sets).
Sent at every mount; A19 rule 5 makes a repeat of the current version a no-op, so "sent on
every mount" and "re-sent when its version changed" are one behaviour. On `rappel:ready`
with `ledger: 'ephemeral'` the existing `notSaved` line shows.

## Honesty rules

- The Book never marks a miss learned. It never posts `rappel:restore` for this deck, never
  edits a row, never removes a card because of a later correct answer. Only the cap removes.
- A grade in this deck is evidence like any deck's (source `'rappel'`), under the miss's own
  skill. It is not a second pass at the round: the round's miss stays in the evidence window.
- The page says the cap, says when the frame is not saving, and says nothing about a miss
  made on another device.

## Strings, all `{en, es}`, in `js/i18n.js`

| key | en | es |
|---|---|---|
| `missesTitle` | Your misses | Tus fallos |
| `missesLead` | A wrong answer in a round becomes a card here, and shows up in your next review. Rappel decides when you have learned it; this page never marks it learned. | Una respuesta incorrecta en una ronda se convierte aquí en una tarjeta y aparece en tu próximo repaso. Rappel decide cuándo la has aprendido; esta página nunca la marca como aprendida. |
| `missesCap` | Keeps your newest 200 misses; older ones drop off. | Guarda tus 200 fallos más recientes; los más antiguos se descartan. |
| `missesCount` | {n} cards, not reviewed yet | {n} tarjetas, todavía sin repasar |
| `missesFrom` | From {name} | De {name} |
| `beatsBack` | {n} beats · {split} | {n} tiempos · {split} |
| `soundBack` | {sound} · {row} | {sound} · {row} |
| `missesUnknownCard` | Rappel graded a card this page cannot place, so it was not recorded. | Rappel calificó una tarjeta que esta página no puede ubicar, así que no se registró. |
