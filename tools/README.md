# tools/

**Everything here is a manual data step, not a build.** A person runs these
scripts by hand, reads the numbers they print, and commits the output. The site
never runs them, `make serve` never runs them, and nothing in root `make smoke`
runs them. Runcible loads static JSON and one vendored library; if every
upstream in `lib/sources.mjs` disappeared tomorrow the site would not notice.

This is the same discipline `projects/aficion-site/data/README.md` set: the
validator "exits 0, or it exits 1 and names the file, the record and the field.
Nothing runs it for you." Running it is part of the definition of done for any
change under `data/`.

## Order

The scripts are not independent. Later ones read what earlier ones emitted, on
purpose: a sentence slice can only contain words the vocabulary slice teaches,
and a deck can only contain items the corpus contains.

```
node tools/build-vocab.mjs        # data/vocab/ch{4,5,6}.json          JMdict
node tools/build-kanji.mjs        # data/kanji/kanjidic-*.json         KANJIDIC2
node tools/build-strokes.mjs      # data/kanji/strokes-*.json          KanjiVG
node tools/build-sentences.mjs    # data/sentences/ch{4,5}.json        Tatoeba
node tools/build-decks.mjs        # books/japanese/decks/, rappel data/decks/
node tools/vendor-wanakana.mjs    # js/vendor/wanakana.js in both projects
node tools/validate-corpus.mjs    # the gate
```

`build-sentences.mjs` reads `data/vocab/`; `build-decks.mjs` reads all three
corpus directories. Each one stops and says which script to run first.

## Looking at what you generated

`tools/preview-corpus.html` is a dev-only page, `noindex`, linked from nowhere.
Serve the project and open `/tools/preview-corpus.html`: it fetches every
emitted file, reports parse status and byte size, renders a sample of the
stroke data as real SVG, exercises the vendored wanakana, and prints the
acknowledgement blocks the shell will have to render. It is how the browser
check in the definition of done is done without writing throwaway code each
time.

## What it needs

- **node** (tested on v25.4.0), no npm install, no dependency.
- **`unzip`** and **`bunzip2`** on the host. Both ship with macOS and Linux.
  `bunzip2` is not a convenience: Tatoeba publishes bz2 and browsers cannot
  decode it, since `DecompressionStream` handles gzip and deflate only. That is
  precisely why the conversion is a checked-in script with a committed output
  rather than something the site does at load time.
- **Network**, once. Roughly 43 MB of upstream archives land in a cache
  **outside the repository** (`$TMPDIR/runcible-corpus-cache`, override with
  `RUNCIBLE_CACHE`), so a site that publishes its own source never carries a
  25 MB dictionary archive by accident.

## Sources, pinned

`lib/sources.mjs` holds the URL, release tag, byte count and SHA-256 of every
upstream, recorded from the fetch that produced the committed data. A mismatch
prints a note rather than failing, so a silent change of source is impossible
but a re-release does not block a rebuild.

| Source | Release | Licence of the output |
|---|---|---|
| jmdict-simplified `jmdict-eng-common` | `3.6.2+20260831182826` | CC BY-SA 4.0 |
| jmdict-simplified `kanjidic2-en` | `3.6.2+20260831182826` | CC BY-SA 4.0 |
| KanjiVG | `r20250816` | CC BY-SA 3.0 |
| Tatoeba jpn, eng, jpn-eng links | export of 2026-08-29 | CC BY 2.0 FR |
| wanakana | `5.3.1` | MIT |

**Derived data inherits the source licence, not the repo's MIT.** A trimmed
vocabulary file made from JMdict is CC BY-SA 4.0. Every emitted file opens with
a `_licence` block carrying the exact required acknowledgement and
`screen: "required"`, which is what makes the shell render it. See
`CONTRACTS.md` C11.

## Not used, and the reason

Recorded here so nobody re-opens it while reading a tempting README elsewhere.

| Rejected | Why |
|---|---|
| `kuromoji.js` | 17 MB of dictionary and a CommonJS entry point. Furigana comes from JMdict entries, which already carry both forms. |
| `jlpt-vocab-api` | **No licence file at all**, so all rights reserved. |
| BCCWJ frequency lists | "Free for use for research or educational purposes" is not a free licence. JMdict's own `common` flag gives frequency, and we already pay its attribution. |
| Kaishi 1.5k and the Core decks | Unlicensed. Kaishi's own README says its data came from the Core decks, and neither repo ships a LICENSE. |
| animCJK | LGPL for kana and Arphic for kanji, two licence regimes inside one feature. KanjiVG covers both under one CC BY-SA 3.0 grant. |

## The one rule that does not bend

Card identity in a generated deck is `noteId + ":" + templateId`, a string,
never an index. `build-decks.mjs` derives note ids from selection order, so
re-running it over the same corpus emits the same ids. That string is the
review ledger's foreign key: an id that moves between runs discards a person's
study history on every card it touches, and nothing would report it.

## Rolling back

Every output is committed JSON. A bad run is `git diff` then `git checkout` on
`data/`, `books/japanese/decks/` and `js/vendor/`; there is no state anywhere
else and no migration to reverse. To go back to a previous upstream, change the
pin in `lib/sources.mjs`, delete the cache directory, and re-run.
