import assert from "node:assert/strict";
import test from "node:test";
import { hasInvalidWorkingHours } from "./schedule.js";

test("accepts separate working intervals for the same day", () => {
  assert.equal(
    hasInvalidWorkingHours([
      { weekday: 1, startsAt: "10:00", endsAt: "13:00" },
      { weekday: 1, startsAt: "14:00", endsAt: "20:00" }
    ]),
    false
  );
});

test("rejects overlapping working intervals", () => {
  assert.equal(
    hasInvalidWorkingHours([
      { weekday: 1, startsAt: "10:00", endsAt: "16:00" },
      { weekday: 1, startsAt: "15:30", endsAt: "20:00" }
    ]),
    true
  );
});

test("rejects a working interval with an invalid time order", () => {
  assert.equal(
    hasInvalidWorkingHours([
      { weekday: 2, startsAt: "18:00", endsAt: "12:00" }
    ]),
    true
  );
});
