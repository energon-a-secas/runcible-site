/**
 * Everything that touches the network or the disk cache.
 *
 * Split out of tools/build-piano.mjs, which is the entry point and the only
 * thing that runs. Nothing is hot-linked and nothing is committed from here:
 * the `.rdf` and the `.ly` land in the same cache the other builders use,
 * outside the repository, and only the derived JSON is written back.
 *
 * The licence table is here rather than beside the emitting code because it is
 * a fact about upstream: Mutopia licences per piece, this is the closed set of
 * tags its `.rdf` files carry that this corpus accepts, and a tag outside the
 * table stops the run rather than being guessed at.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const CACHE = path.join(
  process.env.RUNCIBLE_CACHE || path.join(os.tmpdir(), 'runcible-corpus-cache'), 'mutopia');

/** Mutopia's licence tags, and the only ones this corpus accepts. */
export const SPDX = {
  'Public Domain': 'public-domain',
  'Creative Commons Attribution-ShareAlike 2.5': 'CC-BY-SA-2.5',
  'Creative Commons Attribution-ShareAlike 3.0': 'CC-BY-SA-3.0',
  'Creative Commons Attribution-ShareAlike 4.0': 'CC-BY-SA-4.0',
  'Creative Commons Attribution 3.0': 'CC-BY-3.0',
  'Creative Commons Attribution 4.0': 'CC-BY-4.0',
};

export function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Download once into the cache, outside the repository. */
export function fetchFile(base, dir, name) {
  fs.mkdirSync(CACHE, { recursive: true });
  const dest = path.join(CACHE, name);
  if (!fs.existsSync(dest)) {
    const url = `${base}${dir}/${name}`;
    process.stderr.write(`fetch ${url}\n`);
    execFileSync('curl', ['-sSL', '--fail', '--max-time', '120', '-o', dest, url], { stdio: 'inherit' });
  }
  return dest;
}

/** The handful of tags this corpus reads out of a Mutopia .rdf. */
export function parseRdf(text) {
  const out = {};
  for (const m of text.matchAll(/<mp:([A-Za-z0-9]+)>([^<]*)<\/mp:[A-Za-z0-9]+>/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}
