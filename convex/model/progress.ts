/**
 * The data half of contract C7.5 for Runcible, with the owner passed in.
 *
 * Why the split: convex/progress.ts is then three lines of identity check per
 * function and nothing else, and these helpers can be exercised against a real
 * deployment without a Clerk session. See convex/README.md for that recipe.
 * The Convex convention for helper modules is convex/model/, and stash-site
 * already does the same thing at convex/lib/validate.ts.
 *
 * Nothing here reads identity. The caller supplies `owner`, and the only
 * caller that ships is the one that takes it from identity.subject.
 */
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { rowWins, mergeEvidence } from "../merge";

/** Read and write caps. A caller with more rows than this pages, see js/sync.js. */
export const PAGE = 500;

export type ChapterRow = {
  chapterId: string;
  state: string;
  override: boolean;
  rungs: string;
  updatedAt: number;
};
export type EvidenceRow = {
  skill: string;
  attempts: number;
  correct: number;
  recent: string;
  updatedAt: number;
};
export type PrefRow = { key: string; value: string; updatedAt: number };

export async function readProgress(ctx: QueryCtx, owner: string, bookId: string) {
  const chapterDocs = await ctx.db
    .query("progress")
    .withIndex("by_owner_chapter", (q) => q.eq("clerkSubject", owner).eq("bookId", bookId))
    .take(PAGE);

  const evidenceDocs = await ctx.db
    .query("evidence")
    .withIndex("by_owner_skill", (q) => q.eq("clerkSubject", owner).eq("bookId", bookId))
    .take(PAGE);

  const prefDocs = await ctx.db
    .query("prefs")
    .withIndex("by_owner_key", (q) => q.eq("clerkSubject", owner))
    .take(PAGE);

  return {
    ok: true as const,
    truncated: chapterDocs.length === PAGE || evidenceDocs.length === PAGE,
    chapters: chapterDocs.map((d) => ({
      chapterId: d.chapterId,
      state: d.state,
      override: d.override,
      rungs: d.rungs,
      updatedAt: d.updatedAt,
    })),
    evidence: evidenceDocs.map((d) => ({
      skill: d.skill,
      attempts: d.attempts,
      correct: d.correct,
      recent: d.recent,
      updatedAt: d.updatedAt,
    })),
    prefs: prefDocs.map((d) => ({ key: d.key, value: d.value, updatedAt: d.updatedAt })),
  };
}

export async function writeProgress(
  ctx: MutationCtx,
  owner: string,
  args: {
    bookId: string;
    chapters?: ChapterRow[];
    evidence?: EvidenceRow[];
    prefs?: PrefRow[];
  },
) {
  const chapters = args.chapters ?? [];
  const evidence = args.evidence ?? [];
  const prefs = args.prefs ?? [];
  if (chapters.length + evidence.length + prefs.length > PAGE) {
    return { ok: false as const, error: `Too many rows in one push, cap is ${PAGE}`, wrote: 0 };
  }

  let wrote = 0;

  for (const row of chapters) {
    const stored = await ctx.db
      .query("progress")
      .withIndex("by_owner_chapter", (q) =>
        q.eq("clerkSubject", owner).eq("bookId", args.bookId).eq("chapterId", row.chapterId),
      )
      .first();
    if (!stored) {
      await ctx.db.insert("progress", { clerkSubject: owner, bookId: args.bookId, ...row });
      wrote++;
    } else if (rowWins(stored.updatedAt, row.updatedAt)) {
      await ctx.db.patch(stored._id, {
        state: row.state,
        override: row.override,
        rungs: row.rungs,
        updatedAt: row.updatedAt,
      });
      wrote++;
    }
  }

  for (const row of evidence) {
    const stored = await ctx.db
      .query("evidence")
      .withIndex("by_owner_skill", (q) =>
        q.eq("clerkSubject", owner).eq("bookId", args.bookId).eq("skill", row.skill),
      )
      .first();
    if (!stored) {
      await ctx.db.insert("evidence", { clerkSubject: owner, bookId: args.bookId, ...row });
      wrote++;
      continue;
    }
    const merged = mergeEvidence(stored, row);
    if (merged) {
      await ctx.db.patch(stored._id, merged);
      wrote++;
    }
  }

  for (const row of prefs) {
    const stored = await ctx.db
      .query("prefs")
      .withIndex("by_owner_key", (q) => q.eq("clerkSubject", owner).eq("key", row.key))
      .first();
    if (!stored) {
      await ctx.db.insert("prefs", { clerkSubject: owner, ...row });
      wrote++;
    } else if (rowWins(stored.updatedAt, row.updatedAt)) {
      await ctx.db.patch(stored._id, { value: row.value, updatedAt: row.updatedAt });
      wrote++;
    }
  }

  return { ok: true as const, wrote };
}

export async function clearProgress(ctx: MutationCtx, owner: string, bookId: string) {
  let deleted = 0;

  const chapterDocs = await ctx.db
    .query("progress")
    .withIndex("by_owner_chapter", (q) => q.eq("clerkSubject", owner).eq("bookId", bookId))
    .take(PAGE);
  for (const doc of chapterDocs) {
    await ctx.db.delete(doc._id);
    deleted++;
  }

  const evidenceDocs = await ctx.db
    .query("evidence")
    .withIndex("by_owner_skill", (q) => q.eq("clerkSubject", owner).eq("bookId", bookId))
    .take(PAGE);
  for (const doc of evidenceDocs) {
    await ctx.db.delete(doc._id);
    deleted++;
  }

  const remaining = chapterDocs.length === PAGE || evidenceDocs.length === PAGE ? 1 : 0;
  return { ok: true as const, deleted, remaining };
}
