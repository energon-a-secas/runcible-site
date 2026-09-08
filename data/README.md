# The Runcible corpus

The content is the product. It lives here as static JSON and nowhere else.
**No corpus entry ever goes inside a `.js` file.** The validators are code, the
corpus is not.

Schema and licence convention: `docs/delivery/CONTRACTS.md` contract 11, frozen
2026-09-04. This file does not restate it. It says how to work in here without
breaking it.

## The one rule that is not negotiable

**Derived data carries the share-alike licence of its source, not this repo's
MIT.** JMdict, KANJIDIC2, KanjiVG and Kanjium are all CC BY-SA. Any JSON derived
from them inherits that, and the project `LICENSE` excludes `data/` from MIT and
points here.

The second half of the same rule: **the EDRDG acknowledgement is required on
every screen that displays dictionary words**, in EDRDG's own wording, not a
paraphrase. That is why `_licence.screen` exists and why it is not decoration.

```
data/
  README.md                    this file
  kana/hiragana.json           curated, eager
  kana/katakana.json           curated, eager
  kana/ladder.json             curated, eager
  kanji/strokes-kana.json      KanjiVG-derived, lazy (moved by A6)
  loanwords/seed.json          curated, the scoring authority for the game
  loanwords/rules.json         curated, hints and explanations only
  songs/index.json             the catalog. A static site cannot list a directory.
  songs/<id>.json              one file per song, 19 of them
  vocab/<chapter>.json         JMdict slice
  kanji/kanjidic-<set>.json    KANJIDIC2 slice
  kanji/strokes-<set>.json     KanjiVG-derived
  kanji/phon-groups.json       KanjiVG phon tags plus KANJIDIC readings
  sentences/<chapter>.json     Tatoeba slice
  reading/<story>.json         Aozora Bunko story, public domain in both jurisdictions
  phrases/ch14.json            the one authored file. See below
  piano/keys,notes,theory.json authored facts about the instrument and the stave
  piano/pieces-*.json          Mutopia scores, one file per maintainer
```

61 files. Nine of them are not a slice of a dictionary and each is its own
case: the three kana tables, the two loanword files, the song catalog, the
three Piano fact files. Everything else is derived, and derived means the
licence below is not this repo's.

## Before you commit anything in here

```bash
cd projects/runcible-site
make validate
```

It exits 0, or it exits 1 and names the file and the line. Nothing runs it for
you: it is not in root `make smoke`. Running it is part of the definition of
done for any change under `data/` or `books/`.

`make validate` runs five gates: `check-licence.mjs`, `validate-book.mjs`,
the shell rules, `validate-corpus.mjs` over the derived formats, and
`validate-phrases.mjs` over the one authored file. Each is its own target and
one schema, so there is never a second opinion about what valid means.

`tools/check-licence.mjs` is the part of `make validate` that this file is
about. It enforces four things, and the fourth one is why it exists at all:

1. No banned song title anywhere under `books/`, `data/`, `js/` or `tools/`.
2. Neither incipit of the 1942 revision of the spring brook song, anywhere.
3. Every `data/**/*.json` carries a `_licence` block with `source`, `spdx` and
   `screen`, and carries an `acknowledgement` whenever `screen` is `required`.
4. No song file carrying more verses than its `verses_permitted` allows, exactly
   19 song files, and their ids matching the frozen list in the checker.

## The `_licence` header

JSON cannot carry comments, so **every file under `data/` opens with a
`_licence` object.** That object is the header.

```json
{
  "_licence": {
    "source": "who this came from, in words",
    "url": "where the licence or the source text lives",
    "spdx": "CC-BY-SA-4.0",
    "derived": true,
    "id": "edrdg",
    "acknowledgement": "the exact sentence a screen must show, or null",
    "links": ["..."],
    "screen": "required",
    "generated_by": "the script or the workstream that produced this",
    "generated_at": "2026-09-04"
  },
  "entries": []
}
```

| Field | What it decides |
|---|---|
| `spdx` | the licence this file is under. Not the repo's MIT when `derived` is true. |
| `derived` | true when the content came out of an external dataset rather than being written here |
| `id` | matches an entry in the Book manifest's `credits[]`, so the shell can name the source |
| `screen` | `required` puts the acknowledgement on every screen that renders this file. `none` does not. |
| `acknowledgement` | the text itself. **Required whenever `screen` is `required`**, and the checker fails without it: an obligation that renders as an empty string is a breach that looks correct. |

Song files add three more: `japan`, `us` and `verses_permitted`. See below.

### The three attributions whose exact wording matters

| `id` | Wording |
|---|---|
| `edrdg` | "This site uses the JMdict/EDICT and KANJIDIC dictionary files. These files are the property of the Electronic Dictionary Research and Development Group, and are used in conformance with the Group's licence." plus links to the JMdict and KANJIDIC project pages |
| `kanjivg` | "Attribution. You must attribute the work by stating your use of KanjiVG in your own copyright header and linking to KanjiVG's website (http://kanjivg.tagaini.net)" |
| `tatoeba` | CC BY 2.0 FR, naming Tatoeba and linking https://tatoeba.org/en/downloads |

Do not improve this prose. It is quoted, not written.

### Where the acknowledgement renders, and why it is not your job

A site-owned `.neo-attrib` block **at the foot of the main content region**, on
every screen whose rendered data declares `screen: "required"`. The shell emits
it from the data declaration, so an author cannot forget it.

Not in the Footer Kit: its `minimal` mode is budgeted at about 70px for one
line, the EDRDG wording is 213 characters, and the footer is shared by 60 sites.
Not behind a modal either: the licence asks for the acknowledgement "on each
screen display", and a link to a modal is not the acknowledgement.

## The songs

**19 songs ship. Not 20, not 21.** The research checked 24 candidates against
two tests and 19 passed both:

- **Japan.** Both authors died in 1967 or earlier, or the work is anonymous and
  was published in 1967 or earlier. The 2018 extension from 50 to 70 years pma
  revived nothing, and terms run to the end of the calendar year.
- **US.** Published in 1930 or earlier, or published later with every author
  dead in 1945 or earlier, because the URAA restored anything still protected in
  its source country on 1996-01-01.

Every song file carries both verdicts with the basis, the test it applied, and a
confidence rating, so the judgment travels with the data instead of living in a
report nobody opens. One song, Aka Tombo, is **medium-high** rather than high for
the US, because the verdict rests on its melody being published in 1927 and a
first publication in 1931 or later would restore it via the URAA until 2027. Its
`_licence.note` says so in full. PLAN records it as open question U2.

`verses_permitted` is the number of verses the file may carry. It is sometimes a
copyright limit and sometimes a verification limit, and the file says which:

| Song | `verses_permitted` | Why |
|---|---|---|
| Donguri Korokoro | 2 | copyright. The third verse is not public domain. |
| Ware wa Umi no Ko | 3 | verses 6 and 7 are public domain but are wartime copy dropped from postwar textbooks |
| every other song | 1 | the research transcribed the first verse only. More verses need a fresh trip to the source, not a memory. |

### The five that must never appear

Named here by romaji and by description, never in Japanese, because the rule is
that the titles do not appear anywhere in this repository and a document that
spells them out is the first violation of it. `tools/check-licence.mjs` holds
them as `\u` escape sequences for the same reason, which is also why the checker
can scan itself and pass.

| Song | Why it fails |
|---|---|
| Umi, the 1941 sea song | lyricist and composer both died 1974: Japan to 2045, and URAA-restored in the US to 2036 |
| Haru no Ogawa **as sung**, meaning the 1942 revision | the reviser died 1974, so Japan to 2045. The 1912 text is public domain and is what `songs/haru-no-ogawa.json` carries. |
| Kisha Poppo | lyricist died 1975: Japan to 2046, and URAA-restored. Its 1937 title is the same work and is banned too. |
| Yuyake Koyake | lyricist died 1972, so Japan to 2043. US-clear and Japan-blocked is still blocked. |
| the third verse of Donguri Korokoro | verses 1 and 2 are public domain, the third is not |

Two more are excluded and are not among the 19: both settings of Koinobori. One
has a court decision and a JASRAC record pointing in opposite directions, the
other could not be verified from any source at all.

The sea song's title is a single very common character, so the checker permits
it only inside an allowed phrase, currently just the tail of the title of Ware
wa Umi no Ko. **Adding to that allowlist is a licence decision**, so do it with a
comment naming the phrase, or write the word in kana instead.

**Paste-your-own lyrics never come here.** They stay in the visitor's
`localStorage` under `runcible:lyrics:v1`, are never synced, and are never
encoded into a URL. The Convex schema deliberately has no table for them.

## The kana files

Every character in `kana/hiragana.json` and `kana/katakana.json` was resolved
from its Unicode character name and then asserted equal to the character in the
research report's table. **Nothing in there was typed by hand, and a change
should keep it that way**, because a mistyped kana is invisible in review and
teaches the wrong character forever.

The one-off generator that did it is not in this repo, so the property is
currently a claim rather than an invariant. The cheap way to make it an
invariant, for whoever writes `tools/validate-corpus.mjs`: every gojuon record
carries `pair`, the same sound in the other script, and the two code points are
always exactly `0x60` apart. Three lines, and it catches any single mistyped
character in either table.

Records are one per line on purpose. Six short fields spread over six indented
lines cost about 55 bytes of whitespace each, and the eager kana budget is 40 KB
for all three files together.

The extended katakana digraphs carry `"romaji": null`. The research lists the
digraphs and gives no romaji for them, and this corpus does not supply Japanese
from an agent's own knowledge. The example words on rules B16 and B17 in
`loanwords/rules.json` are the sourced way to read them.

## The loanword game

`loanwords/seed.json` is the **scoring authority**. Grade against `accept`, and
against nothing else. `accept` holds every spelling that is correct, and where
the research found two attested spellings both are correct: a grader that takes
only the first is a bug. Three entries have two forms today.

`loanwords/rules.json` generates **hints and explanations only**. It never
grades. Roughly 80 percent of English-to-katakana is deterministic and the rest
is convention: gemination, whether a final long vowel keeps its bar, which of two
attested spellings a word takes, and every pre-1950 borrowing. The 1991 Cabinet
Notice declines to pick between attested spellings on purpose, so a game that
marked one of a pair wrong would contradict the notice it is built on.

Each rule carries a `kind`: `D` deterministic, `C` convention, `M` mostly
deterministic with a named exception class. That classification is the
researcher's own synthesis, not a source's, and the file says so.

## The graded reading stories

`reading/<story>.json` is one Aozora Bunko story per file, sliced by
`tools/build-reading.mjs`. Four ship: たけのこ (card 4725), がちょうの
たんじょうび (4726), こぞうさんの おきょう (4727) and 狐のつかい (4677).

**Every safety judgment is re-derived from Aozora's own bibliography CSV on
every run**, never trusted from the selection file, so a story cannot drift in
on a stale note. Three filters, and each one is a real trap:

- **orthography must be 新字新仮名.** Aozora publishes several of these stories
  twice, once in the pre-1946 spelling. Teaching a beginner an orthography
  abandoned in 1946 is the failure the research named.
- **the work's copyright flag must be the expired one**, and every contributor
  on the card, translators included, must have died in 1945 or earlier. That is
  the same two-jurisdiction test the songs take, and it is why these files carry
  `japan`, `us` and `card` beside the usual `_licence` fields.
- **no U+FFFD anywhere.** The archives are Shift_JIS and a mojibake character
  in a reading passage is a wrong lesson that renders correctly.

The selection file is an **allowlist and not a top-N by kana ratio**, and the
reason is recorded in `selection/reading.json`: the research measured all 413
dual-jurisdiction-safe children's works and one title in the safe set is a slur
in modern Japanese. An automatic selection would have shipped it.

**Ruby is not free on these files.** Aozora's markup carries `《》` ruby, but
the three easiest stories measure essentially none, so only the story that has
it carries a reading drill over `#ruby`. `validate-corpus.mjs` fails a chapter
pointer at a `#ruby` fragment with fewer than eight entries rather than letting
a drill mount empty.

## The one authored file

`phrases/ch14.json` is the exception this README has to name out loud, because
every other rule here exists to prevent it. It holds the sentence patterns and
the two-turn exchanges chapter 14 shows **as prose on a page**, written for
this Book, `CC0-1.0`, `derived: false`, `screen: none`.

Three rules keep it from becoming a corpus:

1. **Nothing in it is ever scored.** It is read by `table` pages only. Every
   graded item of language in this Book comes from JMdict, Tatoeba or the kana
   and kanji tables. An invented sentence a learner is graded on is content we
   made up wearing a corpus's clothes.
2. **Every field is a string**, `kana`, `en`, `es` and `slot` alike, never an
   `{en, es}` object. `js/render-pages.js` stringifies whatever cell it is
   handed, so an object prints as `[object Object]`. The page carries both
   languages as separate columns instead.
3. **Every content word is checked against `vocab/ch14.json`.**
   `tools/validate-phrases.mjs` is the gate, wired into `make validate`. There
   is no Japanese tokenizer in this repo, so the file carries its own
   segmentation and its own claims and the validator checks that the two agree.
   A word the Book never taught fails the run.

The page that renders it says on its face that the two turns were written for
this Book. That sentence is not decoration either.

## The Piano corpus

`piano/{keys,notes,theory}.json` are authored facts about an instrument and a
stave: where a key sits, what a line of the treble clef is called, how many
beats a written bar holds. Facts, `public-domain`, `screen: none`. Every field a
`prompt` or an `answer` names is a **string**, for the same reason the phrases
file gives.

`piano/pieces-*.json` are Mutopia Project scores, and two things about them are
worth carrying:

- **The licence is read out of each piece's own `.rdf`, never typed.** Mutopia
  licences per file, not per composer, so a public-domain Czerny and a
  CC BY-SA 2.5 Schumann can sit in the same download. `build-piano.mjs` maps the
  `.rdf` tag to an SPDX id from a closed table and stops on a tag it does not
  know.
- **One `_licence` block names one maintainer, so the file splits per
  maintainer.** Seven public-domain pieces have four different typesetters and
  one attribution wording cannot name four people, so there are four
  `pieces-pd-*.json` files rather than one. The generator asserts it: two
  maintainers in one file refuse the write instead of picking a name.

A bar the generator cannot read exactly (a chord, polyphony, a grace note, a
tuplet, or durations that do not sum to the time signature) contributes no
drill items. Five of the twelve pieces are readable in no bar at all; they keep
their place, their grade and their credits, and the chapter names all five and
why. A score inferred from an ambiguous bar would be an invented note with a
licence claim attached.

## Size budget

**No single JSON file over 150 KB**, and the eager load is capped at **40 KB
total**, which is the two kana tables and the ladder. The Today view has to be
usable from that alone: a visitor in Chile on a US-hosted origin should not wait
on a dictionary slice to see what to do today. Everything else is fetched when
its chapter opens, and the full dumps are never shipped.

| File | Cap | Loading |
|---|---|---|
| `kana/{hiragana,katakana,ladder}.json` | 40 KB for all three | eager |
| `kana/strokes.json` | 80 KB | lazy |
| `loanwords/seed.json` | 30 KB | lazy |
| `songs/<id>.json` | 12 KB each | lazy |
| `vocab/<chapter>.json`, `kanji/kanjidic-<set>.json`, `sentences/<chapter>.json` | 120 KB | lazy |
| `kanji/strokes-<set>.json` | 150 KB | lazy |
| `kanji/phon-groups.json` | 150 KB | lazy |
| `reading/<story>.json` | 150 KB, and `build-reading.mjs` refuses a longer story | lazy |
| `phrases/ch14.json` | 30 KB | lazy |
| `piano/{keys,notes,theory}.json` | 30 KB each | lazy |
| `piano/pieces-*.json` | 120 KB | lazy |

**The eager cap is per view, and two chapters now open near the file cap
rather than near the eager one.** `12-handwriting` fetches 160 KB across five
stroke files when it opens and `10-kanji-beyond` is in the same position, both
because a handwriting or kanji rung needs the paths themselves. That is inside
C11.6, which caps a file at 150 KB and the *eager* load at 40 KB, and the
ladder no longer fetches a chapter's data to draw itself. It is still the
largest chapter open in the Book and worth knowing before a sixth file is
added to either one.

## Adding a file in here

1. **Write the `_licence` block first.** If you cannot name the source and the
   licence, you cannot add the file.
2. **Pick `screen` deliberately.** `required` for anything derived from a
   CC BY-SA dataset. `none` only when nothing here came from one.
3. **Declare it in the Book manifest.** The shell resolves a `src` from a chapter
   only if that exact path appears in `book.json`'s `data[]`. An undeclared path
   is a load error naming the file, which is what keeps the content and the
   corpus in separate hands.
4. **Check the size** against the table above.
5. `make validate`.

## What is not built

- **The pronunciation subset for the loanword game.** Every adaptation rule is
  stated over phonemes and English spelling does not give you phonemes. The
  research recommends a CMUdict subset covering only the seeded list, a few KB
  once cut down from 3.5 MB. The research reports contain no phoneme strings, so
  it was left unbuilt rather than invented. `loanwords/seed.json` says the same
  thing in its `pronunciation` field.
- **Verses 2 and 3 of Ware wa Umi no Ko.** Its `verses_permitted` is 3 and the
  research says to ship verses 1 to 3, but the report prints only the first.
  Two verses are missing, not omitted.
