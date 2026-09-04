import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { readProgress, writeProgress, clearProgress } from "./model/progress";

// Contract C7.5. Three functions, one book at a time.
//
// Each one is an identity check and a call into convex/model/progress.ts.
// clerkSubject is never an argument: it is always identity.subject, because a
// subject passed in from the client is a subject a client can forge.

const chapterRow = v.object({
  chapterId: v.string(),
  state: v.string(),
  override: v.boolean(),
  rungs: v.string(),
  updatedAt: v.number(),
});

const evidenceRow = v.object({
  skill: v.string(),
  attempts: v.number(),
  correct: v.number(),
  recent: v.string(),
  updatedAt: v.number(),
});

const prefRow = v.object({
  key: v.string(),
  value: v.string(),
  updatedAt: v.number(),
});

/**
 * The whole server-side picture for one book. C7.5.
 * An unauthenticated caller gets empty arrays and ok:false rather than an
 * exception, so a page that calls this with no session renders normally.
 */
export const pull = query({
  args: { bookId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { ok: false, error: "Not authenticated", chapters: [], evidence: [], prefs: [] };
    }
    return await readProgress(ctx, identity.subject, args.bookId);
  },
});

/**
 * Write progress for one book. C7.6: per-row last-write-wins by updatedAt for
 * chapters and prefs, summed deltas for evidence. Every array is optional, so a
 * caller with only prefs to write sends only prefs.
 */
export const push = mutation({
  args: {
    bookId: v.string(),
    chapters: v.optional(v.array(chapterRow)),
    evidence: v.optional(v.array(evidenceRow)),
    prefs: v.optional(v.array(prefRow)),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false, error: "Not authenticated", wrote: 0 };
    return await writeProgress(ctx, identity.subject, args);
  },
});

/**
 * Delete every chapter and evidence row for one book. C7.5.
 *
 * Prefs are deliberately left alone: they are keyed by (subject, key) with no
 * book, so clearing one book must not drop the visitor's language and track.
 *
 * Deletes at most PAGE rows per call and reports what is left, so a caller
 * repeats until `remaining` is 0 rather than hitting a transaction limit.
 */
export const clear = mutation({
  args: { bookId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false, error: "Not authenticated", deleted: 0, remaining: 0 };
    return await clearProgress(ctx, identity.subject, args.bookId);
  },
});
