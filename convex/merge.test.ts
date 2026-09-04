// Run with: node --test convex/merge.test.ts   (node 22.6+ strips the types)
//
// Convex ignores this file: its bundler skips any basename with more than one
// dot (convex/dist/cjs/bundler/index.js, the entryPoints walk), so it is never
// pushed to a deployment.
import test from "node:test";
import assert from "node:assert/strict";
import { rowWins, mergeEvidence } from "./merge.ts";

test("rowWins: strictly newer replaces, equal and older do not", () => {
  assert.equal(rowWins(100, 101), true);
  assert.equal(rowWins(100, 100), false, "a re-push of an unchanged row must write nothing");
  assert.equal(rowWins(100, 99), false);
});

test("mergeEvidence sums when the stored row is strictly older", () => {
  const stored = { attempts: 40, correct: 36, recent: "[1,1,0]", updatedAt: 100 };
  const incoming = { attempts: 20, correct: 18, recent: "[1,1,1]", updatedAt: 101 };
  const merged = mergeEvidence(stored, incoming);
  assert.deepEqual(merged, { attempts: 60, correct: 54, recent: "[1,1,0,1,1,1]", updatedAt: 101 });
});

test("mergeEvidence keeps the stored row whole when it is not older", () => {
  const stored = { attempts: 40, correct: 36, recent: "[1]", updatedAt: 100 };
  assert.equal(mergeEvidence(stored, { attempts: 5, correct: 5, recent: "[1]", updatedAt: 100 }), null);
  assert.equal(mergeEvidence(stored, { attempts: 5, correct: 5, recent: "[1]", updatedAt: 99 }), null);
});

test("two devices working on different chapters both survive", () => {
  // The failure this rule exists to prevent: one document with last-write-wins
  // over the whole book would drop whichever device pushed first.
  const server = new Map<string, { state: string; updatedAt: number }>();
  const write = (id: string, row: { state: string; updatedAt: number }) => {
    const stored = server.get(id);
    if (!stored || rowWins(stored.updatedAt, row.updatedAt)) server.set(id, row);
  };
  write("1-hiragana", { state: "passed", updatedAt: 1000 }); // phone, morning
  write("2-katakana", { state: "available", updatedAt: 1200 }); // laptop, evening
  assert.equal(server.get("1-hiragana")?.state, "passed");
  assert.equal(server.get("2-katakana")?.state, "available");
});
