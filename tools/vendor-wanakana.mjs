#!/usr/bin/env node
/**
 * Vendor wanakana 5.3.1 into both projects.
 *
 * THIS IS A MANUAL DATA STEP, NOT A BUILD.
 * Run it by hand, commit the output, never wire it into CI or `make serve`:
 *
 *   node tools/vendor-wanakana.mjs
 *
 * PLAN constraint 1: wanakana is the one third-party runtime library this
 * campaign sanctions, and it is VENDORED, NOT HOT-LINKED TO A CDN. A site that
 * imports it from jsDelivr breaks when jsDelivr does, ships a different build
 * to the visitor than the one that was reviewed, and tells jsDelivr who is
 * studying Japanese today. So the bytes live in the repository.
 *
 * What is vendored is the upstream ESM entry, `esm/index.js`, byte for byte.
 * The only edit is the licence header this script prepends, which the same
 * constraint asks for. The upstream SHA-256 of the unmodified file is recorded
 * in that header, so anyone can re-download and diff.
 *
 * Not the minified UMD build (`wanakana.min.js`, 20.2 KB): UMD is not an ES
 * module and cannot be `import`ed by a zero-build site. Not jsDelivr's `+esm`
 * bundle either (18.0 KB, minified ESM): it is a CDN-generated artifact rather
 * than upstream, and it carries a sourceMappingURL pointing back at jsDelivr,
 * which is the coupling this rule exists to avoid.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fetchSource, sha256, SOURCES } from './lib/sources.mjs';
import { SITE, RAPPEL, fmtBytes } from './lib/corpus.mjs';

const TARGETS = [SITE, RAPPEL];

const LICENCE = `The MIT License (MIT)

Copyright (c) 2013 WaniKani Community Github

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;

function header(hash) {
  const s = SOURCES.wanakana;
  return `/*!
 * wanakana ${s.release}
 * Romaji to kana, kana to romaji, and live IME-style input binding.
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2013 WaniKani Community Github
 * https://github.com/WaniKani/WanaKana
 *
 * VENDORED, NOT HOT-LINKED. Fetched once from
 *   ${s.url}
 * upstream sha256 ${hash}
 * by tools/vendor-wanakana.mjs on 2026-09-04. Everything below this header is
 * that file, unmodified. Do not edit it here: change the pin in
 * tools/lib/sources.mjs and re-run the script.
 *
 * Full licence text: wanakana.LICENSE, beside this file.
 */
`;
}

const README = `# js/vendor

Third-party runtime code, vendored. Nothing here is ours and nothing here is
edited by hand.

| File | Version | Licence | Upstream |
|---|---|---|---|
| \`wanakana.js\` | 5.3.1 | MIT | https://github.com/WaniKani/WanaKana |

## Rules

1. **Vendored, never hot-linked.** PLAN constraint 1. No \`import\` from a CDN
   URL, in any module, in either project.
2. **Never edited.** The file is upstream \`esm/index.js\` with a licence header
   prepended and nothing else changed. To update it, change the pin in
   \`tools/lib/sources.mjs\` and run \`node tools/vendor-wanakana.mjs\`.
3. **Exempt from the house style checks**, the way the vendored kits already
   are. \`scripts/no-em-dash.py\` skips any path containing \`/vendor/\`. The
   "no JS file over 500 lines" rule is about our own module discipline:
   \`wanakana.js\` is 1,804 lines of somebody else's library. A per-project
   \`make validate\` that counts lines must exclude \`js/vendor/\`.

## Using it

\`\`\`js
import { toKana, toRomaji, isKana, bind } from './vendor/wanakana.js';
\`\`\`

Load it lazily, on the first typed kana exercise, not at boot. It is 62.6 KB
raw and about 16.2 KB gzipped over the wire.
`;

function main() {
  const src = fetchSource('wanakana');
  const hash = sha256(src);
  const body = fs.readFileSync(src, 'utf8');
  const out = header(hash) + body;

  for (const root of TARGETS) {
    const dir = path.join(root, 'js', 'vendor');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'wanakana.js'), out);
    fs.writeFileSync(path.join(dir, 'wanakana.LICENSE'), LICENCE);
    fs.writeFileSync(path.join(dir, 'README.md'), README);
    const bytes = Buffer.byteLength(out);
    process.stdout.write(
      `wrote ${fmtBytes(bytes).padStart(9)}  ${path.join(path.basename(root), 'js/vendor/wanakana.js')}\n`);
  }
  process.stdout.write(`upstream sha256 ${hash}\n`);
}

main();
