/**
 * The Aozora Bunko archive: the bibliography index, and the cache the run
 * downloads into.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD. See tools/build-reading.mjs.
 *
 * Nothing here decides anything about a story. It fetches once into a cache
 * outside the repository, unzips, parses the CSV, and hands back the
 * contributor rows grouped by card id, with the index's own size and digest so
 * the licence block can name the exact bytes it was derived from.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CACHE } from './sources.mjs';

export const AOZORA_CACHE = path.join(CACHE, 'aozora');

// Written as an escape on purpose: a byte-order mark is invisible in an
// editor, so the next reader of this line would see nothing at all.
const BOM = '\uFEFF';

export const INDEX = {
  name: 'Aozora Bunko bibliography, all works by contributor, extended, UTF-8',
  url: 'https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip',
  file: 'list_person_all_extended_utf8.zip',
  member: 'list_person_all_extended_utf8.csv',
};

/** The index columns this script reads, by the name the CSV header gives them. */
const COL = {
  id: '作品ID', title: '作品名', titleKana: '作品名読み', ndc: '分類番号',
  orthography: '文字遣い種別', copyright: '作品著作権フラグ', card: '図書カードURL',
  familyName: '姓', givenName: '名', familyRomaji: '姓ローマ字', givenRomaji: '名ローマ字',
  role: '役割フラグ', death: '没年月日', personCopyright: '人物著作権フラグ',
  textUrl: 'テキストファイルURL', textEncoding: 'テキストファイル符号化方式',
  edition: '底本名1', editionPublisher: '底本出版社名1', editionYear: '底本初版発行年1',
};

export function sh(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] });
}

export function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Download once into the cache outside the repository. */
export function fetchInto(url, name) {
  fs.mkdirSync(AOZORA_CACHE, { recursive: true });
  const dest = path.join(AOZORA_CACHE, name);
  if (!fs.existsSync(dest)) {
    process.stderr.write(`fetch ${url}\n`);
    sh('curl', ['-sSL', '--fail', '--max-time', '600', '-o', dest, url]);
  }
  return dest;
}

/** RFC 4180, because the index quotes fields that contain commas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') { field += c; continue; }
      if (text[i + 1] === '"') { field += '"'; i += 1; continue; }
      quoted = false;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; continue; }
    field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function loadIndex() {
  const zip = fetchInto(INDEX.url, INDEX.file);
  const member = path.join(AOZORA_CACHE, INDEX.member);
  if (!fs.existsSync(member)) sh('unzip', ['-o', '-q', zip, '-d', AOZORA_CACHE]);
  const rows = parseCsv(fs.readFileSync(member, 'utf8'));
  const head = rows[0].map((h) => (h.startsWith(BOM) ? h.slice(1) : h));
  const at = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const key of Object.values(COL)) {
    if (at[key] === undefined) throw new Error(`the index has no column ${key}`);
  }
  const byCard = new Map();
  for (const row of rows.slice(1)) {
    const id = row[at[COL.id]];
    if (!id) continue;
    if (!byCard.has(id)) byCard.set(id, []);
    byCard.get(id).push(Object.fromEntries(
      Object.entries(COL).map(([k, col]) => [k, row[at[col]]])));
  }
  return {
    byCard,
    works: byCard.size,
    rows: rows.length - 1,
    bytes: fs.statSync(zip).size,
    sha256: sha256(zip),
  };
}
