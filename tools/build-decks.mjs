#!/usr/bin/env node
/**
 * Rappel decks, format neo-deck/1 (CONTRACTS C4).
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 * Run it by hand, commit the output, never wire it into CI or `make serve`:
 *
 *   node tools/build-vocab.mjs
 *   node tools/build-kanji.mjs
 *   node tools/build-sentences.mjs
 *   node tools/build-decks.mjs      # last: it reads what the others emitted
 *
 * Writes each deck twice, from one source, so the two copies cannot drift:
 *   ../runcible-site/books/japanese/decks/<id>.json   the chapter deck
 *   ../rappel-site/data/decks/<id>.json               Rappel's own library
 *
 * THE ONE RULE THAT MATTERS HERE. Card identity is `noteId + ":" + templateId`,
 * a string, never an index (C4.2 rule 1). Note ids are derived from the source
 * item id, which is derived from selection order, so a re-run over the same
 * corpus emits the same ids. That string is the foreign key of the review
 * ledger (C5). An id that moves between runs silently discards a person's
 * study history on every card it touches, and nothing would report it.
 *
 * Licence: a deck derived from JMdict or KANJIDIC2 is CC BY-SA 4.0 and one
 * derived from Tatoeba is CC BY 2.0 FR. Neither is the repo's MIT. `screen`
 * is "required" on both, which is what makes Rappel render the acknowledgement
 * under the review area and inside the embed attribution bar.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  SITE, RAPPEL, LICENCES, licenceBlock, readSelection, writeData, GENERATED_AT,
} from './lib/corpus.mjs';

const TOOL = 'tools/build-decks.mjs';
const META_KEYS = new Set(['_licence', 'format', 'set', 'chapter', 'title', 'order', 'count', 'viewBox']);

function readData(rel) {
  const abs = path.join(SITE, 'data', rel);
  if (!fs.existsSync(abs)) {
    process.stderr.write(`missing ${abs}\nRun the build-*.mjs that emits it first.\n`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function licenceFields(id) {
  const l = LICENCES[id];
  return {
    licence: l.spdx,
    attribution: l.acknowledgement,
    source: l.url,
    screen: l.screen,
  };
}

function vocabDeck(spec) {
  const src = readData(spec.from);
  const notes = [];
  for (const groupId of src.order) {
    for (const item of src.groups[groupId]) {
      notes.push({
        id: `n_${item.id.slice(2)}`,
        f: {
          Word: item.word,
          Kana: item.kana,
          Meaning: item.gloss.join(' / '),
          Group: src.labels[groupId].en,
        },
        tags: [groupId],
        templates: ['recognition', 'recall', 'pick'],
      });
    }
  }
  return {
    licenceId: 'edrdg',
    fields: ['Word', 'Kana', 'Meaning', 'Group'],
    templates: [
      {
        id: 'recognition', kind: 'basic', skill: spec.skill_read,
        front: '{{Word}}', back: '{{Meaning}}',
      },
      {
        id: 'recall', kind: 'typed', skill: spec.skill_write,
        answer_field: 'Kana', front: '{{Meaning}}', back: '{{Kana}}',
        transform: 'kana', compare: 'trim|kana',
      },
      {
        id: 'pick', kind: 'choice', skill: spec.skill_read,
        answer_field: 'Meaning', front: '{{Word}}',
        distractors: 'sample-from-deck', count: 4,
      },
    ],
    notes,
  };
}

function kanjiDeck(spec) {
  const src = readData(spec.from);
  const notes = src.order.filter((lit) => src[lit] && !META_KEYS.has(lit)).map((lit, i) => {
    const k = src[lit];
    return {
      id: `n_${String(i + 1).padStart(4, '0')}`,
      f: {
        Kanji: lit,
        On: k.on.join(' '),
        Kun: k.kun.join(' '),
        Meaning: k.meanings.join(' / '),
        Strokes: String(k.strokes),
      },
      tags: [`grade${k.grade}`, `strokes${k.strokes}`],
      templates: ['meaning', 'reading', 'pick'],
    };
  });
  return {
    licenceId: 'edrdg',
    fields: ['Kanji', 'On', 'Kun', 'Meaning', 'Strokes'],
    templates: [
      {
        id: 'meaning', kind: 'basic', skill: spec.skill_meaning,
        front: '{{Kanji}}', back: '{{Meaning}}',
      },
      {
        id: 'reading', kind: 'basic', skill: spec.skill_read,
        front: '{{Kanji}}', back: '{{On}} {{Kun}}',
      },
      {
        id: 'pick', kind: 'choice', skill: spec.skill_meaning,
        answer_field: 'Meaning', front: '{{Kanji}}',
        distractors: 'sample-from-deck', count: 4,
      },
    ],
    notes,
  };
}

function sentenceDeck(spec) {
  const src = readData(spec.from);
  const notes = [];
  for (const groupId of src.order) {
    for (const s of src.groups[groupId]) {
      // Anki cloze syntax, one {{c1::...}} marker, so the card id is
      // n_xxxx:cloze:1 exactly as C4.2 rule 2 describes.
      const cloze = s.word && s.ja.includes(s.word)
        ? s.ja.replace(s.word, `{{c1::${s.word}}}`)
        : null;
      const templates = ['read'];
      if (cloze) templates.push('cloze');
      notes.push({
        id: `n_${s.id.slice(2)}`,
        f: {
          Japanese: s.ja,
          English: s.en,
          Cloze: cloze || s.ja,
          Word: s.word || '',
        },
        tags: [groupId],
        templates,
      });
    }
  }
  return {
    licenceId: 'tatoeba',
    fields: ['Japanese', 'English', 'Cloze', 'Word'],
    templates: [
      {
        id: 'read', kind: 'basic', skill: spec.skill_read,
        front: '{{Japanese}}', back: '{{English}}',
      },
      {
        // text_field is what the renderer reads the {{c1::...}} markers out of
        // (rappel-site/js/deck.js and js/validate-deck.js:212). A cloze
        // template without it validates as broken in Rappel's own validator.
        id: 'cloze', kind: 'cloze', skill: spec.skill_recall,
        text_field: 'Cloze', front: '{{Cloze}}', back: '{{English}}',
      },
    ],
    notes,
  };
}

const BUILDERS = { vocab: vocabDeck, kanji: kanjiDeck, sentences: sentenceDeck };

/**
 * A deck this generator does not own, read from disk instead of rebuilt.
 *
 * Commit 5124bee ("apply the teacher panel") corrected the four decks that
 * shipped first by editing the output and not this file, so a plain re-run
 * throws those corrections away. The three that matter, all confirmed against
 * that commit's diff:
 *
 *   - jp-first-words: the 22 greetings carry no `recall` card. Typing a set
 *     phrase back from its English is not the drill chapter 4 asks for.
 *   - jp-kanji-grade1: the `reading` card is a word to its reading, over two
 *     fields this generator cannot derive. Eight of the eighty have no
 *     single-kanji word in data/vocab/ch6.json at all, and the deck answers
 *     them with an authored compound (deguchi for the exit kanji), so there is
 *     no join that reproduces the file.
 *   - jp-sentences-basic: n_0082 has no cloze card. The word field is the
 *     first two kana of a three-kana word, so the automatic cloze marks the
 *     wrong span. The neighbouring items keep theirs, so no mechanical rule
 *     separates them.
 *
 * `held: true` says that out loud: the deck under books/ is the document, this
 * file copies it to Rappel's library so the two cannot disagree, and the
 * catalog row is counted from the file rather than from a build that did not
 * happen. Moving those three edits into the generator and dropping the flag is
 * the real fix and it is a content decision, not this workstream's.
 */
function heldDeck(bookPath, id) {
  if (!fs.existsSync(bookPath)) {
    process.stderr.write(`${id}: held: true but ${bookPath} is not on disk\n`);
    process.exit(1);
  }
  const bytes = fs.readFileSync(bookPath);
  const deck = JSON.parse(bytes.toString('utf8'));
  return { deck, bytes };
}

function main() {
  const sel = readSelection('decks.json');
  const book = sel.targets.runcible_book;
  const catalog = [];

  for (const spec of sel.decks) {
    const bookPath = path.join(SITE, 'books', book, 'decks', `${spec.id}.json`);
    const rappelPath = path.join(RAPPEL, 'data', 'decks', `${spec.id}.json`);

    if (spec.held) {
      const { deck, bytes } = heldDeck(bookPath, spec.id);
      const cards = deck.notes.reduce((a, n) => a + n.templates.length, 0);
      if (sel.targets.rappel_library) {
        fs.mkdirSync(path.dirname(rappelPath), { recursive: true });
        fs.writeFileSync(rappelPath, bytes);
      }
      catalog.push({
        id: spec.id,
        file: `data/decks/${spec.id}.json`,
        name: spec.name,
        note: `${cards} cards from ${deck.notes.length} notes. ${deck.licence}.`,
        version: deck.version,
        notes: deck.notes.length,
        cards,
        licence: deck.licence,
        screen: deck.screen,
        bytes: bytes.length,
      });
      process.stdout.write(`  ${spec.id}: ${deck.notes.length} notes, ${cards} cards (held, copied not built)\n`);
      continue;
    }

    const build = BUILDERS[spec.kind];
    if (!build) throw new Error(`unknown deck kind: ${spec.kind}`);
    const built = build(spec);
    const deck = {
      format: 'neo-deck/1',
      id: spec.id,
      version: GENERATED_AT,
      name: spec.name,
      lang: { front: 'ja', back: 'en' },
      ...licenceFields(built.licenceId),
      media_base: 'media/',
      fields: built.fields,
      templates: built.templates,
      _licence: licenceBlock(built.licenceId, TOOL, { chapter: spec.chapter }),
      notes: built.notes,
    };
    const cards = built.notes.reduce((a, n) => a + n.templates.length, 0);
    // `escape` is the selection row's, empty on every deck but the first grade
    // 2 kanji one. See writeData in lib/corpus.mjs: one character of KANJIDIC's
    // own grade 2 list is also the whole title of a banned song, so a deck
    // built over that slice is emitted with the character escaped. The parsed
    // value is identical and both copies get the same bytes.
    const escape = spec.escape || [];
    const bytes = writeData(bookPath, deck, spec.budget_kb, escape);
    if (sel.targets.rappel_library) {
      writeData(rappelPath, deck, spec.budget_kb, escape);
      // One source, two files, so the two cannot drift. The writer makes it
      // impossible; this is the assertion that says so out loud, and it is the
      // same one build-sets.mjs makes over its own pair of copies.
      if (!fs.readFileSync(bookPath).equals(fs.readFileSync(rappelPath))) {
        throw new Error(`${spec.id}: the two copies differ, which the writer makes impossible`);
      }
    }
    catalog.push({
      id: spec.id,
      // `file` is the key Rappel's loader reads (js/deck-load.js:41), relative
      // to the site root, not to this directory.
      file: `data/decks/${spec.id}.json`,
      name: spec.name,
      // neo-deck-index/1 keeps `note` a bare string; Rappel's shelf rebuilds
      // the same sentence in the visitor's language from `cards`, `notes` and
      // `licence` (rappel-site/js/render.js builtinRow).
      note: `${cards} cards from ${built.notes.length} notes. ${deck.licence}.`,
      version: deck.version,
      notes: built.notes.length,
      cards,
      licence: deck.licence,
      screen: deck.screen,
      bytes,
    });
    process.stdout.write(`  ${spec.id}: ${built.notes.length} notes, ${cards} cards\n`);
  }

  // Rappel needs a list of what it ships with. A directory is not listable
  // over HTTP, so the catalog is a file, the same way books/index.json is.
  const index = {
    _licence: licenceBlock('edrdg', TOOL, {
      derived: false,
      note: 'This catalog is an index. Each deck it names carries its own licence block.',
    }),
    format: 'neo-deck-index/1',
    version: GENERATED_AT,
    decks: catalog,
  };
  writeData(path.join(RAPPEL, 'data', 'decks', 'index.json'), index, 40);
}

main();
