# Runcible on Convex

Optional, per-user, and dormant until a Clerk key is on the page. The site is
fully usable with no account: this directory only exists so progress can follow
a person between devices.

Contract: `docs/delivery/CONTRACTS.md` C7. The client half is `../js/sync.js`,
which the shell imports and never edits.

## What is here

| File | What it is |
|---|---|
| `schema.ts` | C7.3. Three tables, every row owned by its `clerkSubject` |
| `auth.config.ts` | The fleet's shared Clerk dev instance, JWT template `convex` |
| `sync.ts` | `whoami`, the one function that answers "who does the server think I am" |
| `progress.ts` | `pull`, `push`, `clear`. Each one is an identity check and a call into `model/` |
| `model/progress.ts` | The data half, with the owner passed in. No identity is read here |
| `merge.ts` | The merge rules of C7.6 as pure functions |
| `merge.test.ts` | Runs them under plain node. Convex skips this file: its bundler ignores any basename with two dots |

## Deployment

```bash
npx convex dev --once      # push functions and schema to the dev deployment
npx convex dev             # watch mode
npm test                   # the merge rules, no deployment needed
```

The dev deployment is `knowing-pheasant-276`
(`https://knowing-pheasant-276.convex.cloud`), project `lucio/runcible-site`.
`.env.local` holds the deployment name and is gitignored. `js/sync.js` carries
the URL, which is public by design: authorisation is the Clerk-issued JWT that
Convex verifies, and every function re-checks it.

No Convex environment variable is needed. Neither project has an admin role, so
neither needs the `ADMIN_SUBJECTS` variable memes-site uses.

## Exercising the read path without signing in

`ctx.auth.getUserIdentity()` needs a real Clerk JWT, which the CLI cannot mint.
To check the data path end to end against the deployment, add a temporary
`convex/devcheck.ts` that calls the `model/` helpers with `owner` as an
argument, push it, run the scenario with `npx convex run`, then delete it and
push again. That exercises the same code the shipped functions call, with the
identity check as the only difference.

That is how the merge rules, the per-subject isolation and the read-back were
verified on 2026-09-04. The harness is deliberately not kept: a function that
takes the owner from its arguments must never reach a production deployment.

The full check, with a real Clerk session on two browser profiles, is QA's.
