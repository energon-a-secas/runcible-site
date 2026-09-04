/**
 * The merge rules for Runcible progress, contract C7.6, as pure functions with
 * no Convex context. Two callers: convex/progress.ts, which is the only place
 * they run for real, and convex/merge.test.ts, which is how a human checks them
 * without a deployment or a sign-in.
 */

/**
 * Per-row last-write-wins by updatedAt. Progress is monotone (a chapter never
 * un-passes), so a row that is strictly newer replaces the stored one and a row
 * that is not is discarded. Equal timestamps keep what is stored, which makes a
 * re-push of an unchanged row a no-op.
 */
export function rowWins(storedUpdatedAt: number, incomingUpdatedAt: number): boolean {
  return incomingUpdatedAt > storedUpdatedAt;
}

export type EvidenceRow = {
  attempts: number;
  correct: number;
  recent: string;
  updatedAt: number;
};

/**
 * Skill evidence. C7.6: "merges by summing attempts and correct only when the
 * remote row is strictly older; otherwise the remote wins whole".
 *
 * Read that carefully before writing a caller. Summing is only correct when the
 * incoming row carries the attempts accumulated SINCE THE LAST SUCCESSFUL PUSH,
 * not the visitor's running total. A cumulative row pushed twice would be
 * counted twice. js/sync.js is written to that rule: pushBatch() folds a batch
 * of C2.3 attempts into a delta row, and a full push() of a running total is the
 * caller's own decision to make against an empty or a stale server.
 *
 * Returns the row to write, or null to keep what is stored.
 */
export function mergeEvidence(stored: EvidenceRow, incoming: EvidenceRow): EvidenceRow | null {
  if (!rowWins(stored.updatedAt, incoming.updatedAt)) return null;
  return {
    attempts: stored.attempts + incoming.attempts,
    correct: stored.correct + incoming.correct,
    recent: rollWindow(stored.recent, incoming.recent),
    updatedAt: incoming.updatedAt,
  };
}

/** The window is capped at this many flags, the client's EVIDENCE_CAP (C12 A18). */
export const RECENT_CAP = 200;

/**
 * Append the incoming flags to the stored window and keep the newest RECENT_CAP.
 * A batch carries only the attempts since the last push, so replacing the
 * window with it would leave a second device with a window one batch long
 * and a chapter it had passed reading as locked (C12 A18).
 */
export function rollWindow(stored: string, incoming: string, cap = RECENT_CAP): string {
  const parse = (s: string): unknown[] => {
    try {
      const v = JSON.parse(s || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  return JSON.stringify(parse(stored).concat(parse(incoming)).slice(-cap));
}
