# js/vendor

Third-party runtime code, vendored, plus one Neorgon kit. Nothing here is
edited by hand: `neorgon-auth.js` is the fleet's Clerk and Convex client,
refreshed by `packages/neorgon-ui/sync-auth.sh`, and the rest is upstream.

| File | Version | Licence | Upstream |
|---|---|---|---|
| `wanakana.js` | 5.3.1 | MIT | https://github.com/WaniKani/WanaKana |

## Rules

1. **Vendored, never hot-linked.** PLAN constraint 1. No `import` from a CDN
   URL, in any module, in either project.
2. **Never edited.** The file is upstream `esm/index.js` with a licence header
   prepended and nothing else changed. To update it, change the pin in
   `tools/lib/sources.mjs` and run `node tools/vendor-wanakana.mjs`.
3. **Exempt from the house style checks**, the way the vendored kits already
   are. `scripts/no-em-dash.py` skips any path containing `/vendor/`. The
   "no JS file over 500 lines" rule is about our own module discipline:
   `wanakana.js` is 1,804 lines of somebody else's library. A per-project
   `make validate` that counts lines must exclude `js/vendor/`.

## Using it

```js
import { toKana, toRomaji, isKana, bind } from './vendor/wanakana.js';
```

Load it lazily, on the first typed kana exercise, not at boot. It is 62.6 KB
raw and about 16.2 KB gzipped over the wire.
