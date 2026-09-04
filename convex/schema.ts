import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Contract C7.3, transcribed. Every row is owned by its clerkSubject and no
// user ever reads another's, which is why neither project needs an admin role
// or a Convex environment variable (C7.7).
export default defineSchema({
  /** One row per chapter the learner has touched, in one book. */
  progress: defineTable({
    clerkSubject: v.string(),
    bookId: v.string(),
    chapterId: v.string(),
    state: v.string(), // "locked" | "available" | "passed"
    override: v.boolean(),
    rungs: v.string(), // JSON string: per-rung completion
    updatedAt: v.number(),
  })
    .index("by_owner_chapter", ["clerkSubject", "bookId", "chapterId"])
    .index("by_subject", ["clerkSubject"]),

  /** One row per dotted skill string, per book. Feeds C3.4 unlocking. */
  evidence: defineTable({
    clerkSubject: v.string(),
    bookId: v.string(),
    skill: v.string(),
    attempts: v.number(),
    correct: v.number(),
    recent: v.string(), // JSON string: the rolling window
    updatedAt: v.number(),
  }).index("by_owner_skill", ["clerkSubject", "bookId", "skill"]),

  /** memes-site's userSettings (convex/schema.ts:22-29) with the same two indexes. */
  prefs: defineTable({
    clerkSubject: v.string(),
    key: v.string(), // "lang" | "track" | "reduceMotion"
    value: v.string(),
    updatedAt: v.number(),
  })
    .index("by_owner_key", ["clerkSubject", "key"])
    .index("by_subject", ["clerkSubject"]),
});
