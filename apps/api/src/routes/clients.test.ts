import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDictionaryTitles } from "./clients.js";

test("normalizes private client tags and removes case-insensitive duplicates", () => {
  assert.deepEqual(
    normalizeDictionaryTitles([
      "  Требовательный  ",
      "требовательный",
      "Любит  тишину",
      ""
    ]),
    ["Требовательный", "Любит тишину"]
  );
});
