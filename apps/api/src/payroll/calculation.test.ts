import assert from "node:assert/strict";
import test from "node:test";
import { commissionAmount, currentMonthKey, payrollPeriod } from "./calculation.js";

test("calculates commission in minor units", () => {
  assert.equal(commissionAmount(400_000, 4600), 184_000);
  assert.equal(commissionAmount(400_000, 1300), 52_000);
});

test("rounds fractional commission to the nearest minor unit", () => {
  assert.equal(commissionAmount(101, 4600), 46);
});

test("builds Moscow month boundaries including year rollover", () => {
  const december = payrollPeriod("2026-12");
  assert.equal(december.periodStart.toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(december.periodEnd.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(december.completedFrom.toISOString(), "2026-11-30T21:00:00.000Z");
  assert.equal(december.completedTo.toISOString(), "2026-12-31T21:00:00.000Z");
});

test("determines the current payroll month in Moscow", () => {
  assert.equal(currentMonthKey(new Date("2026-09-30T20:59:59.000Z")), "2026-09");
  assert.equal(currentMonthKey(new Date("2026-09-30T21:00:00.000Z")), "2026-10");
});
