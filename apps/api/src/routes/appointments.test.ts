import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateAppointmentClose,
  requiresPrepaymentPenalty
} from "./appointments.js";

const now = new Date("2026-09-22T09:00:00.000Z");

test("no-show always requires prepayment", () => {
  assert.equal(
    requiresPrepaymentPenalty({
      action: "no_show",
      appointmentStartsAt: new Date("2026-09-30T09:00:00.000Z"),
      now
    }),
    true
  );
});

test("studio cancellation does not penalize a client", () => {
  assert.equal(
    requiresPrepaymentPenalty({
      action: "canceled",
      appointmentStartsAt: new Date("2026-09-22T12:00:00.000Z"),
      initiatedBy: "studio",
      now
    }),
    false
  );
});

test("client cancellation or reschedule is penalized inside 12 hours", () => {
  const appointmentStartsAt = new Date("2026-09-22T20:00:00.000Z");

  assert.equal(
    requiresPrepaymentPenalty({
      action: "canceled",
      appointmentStartsAt,
      initiatedBy: "client",
      now
    }),
    true
  );
  assert.equal(
    requiresPrepaymentPenalty({
      action: "rescheduled",
      appointmentStartsAt,
      initiatedBy: "client",
      now
    }),
    true
  );
});

test("client changes outside 12 hours do not require prepayment", () => {
  assert.equal(
    requiresPrepaymentPenalty({
      action: "canceled",
      appointmentStartsAt: new Date("2026-09-23T09:00:01.000Z"),
      initiatedBy: "client",
      now
    }),
    false
  );
});

test("closing succeeds when payments exactly cover the price", () => {
  assert.deepEqual(
    evaluateAppointmentClose({
      priceMinor: 300,
      payments: [{ amountMinor: 200 }, { amountMinor: 100 }]
    }),
    { ok: true }
  );
});

test("closing rejects a mismatched total without an adjustment reason", () => {
  assert.deepEqual(
    evaluateAppointmentClose({
      priceMinor: 300,
      payments: [{ amountMinor: 200 }]
    }),
    { ok: false, error: "appointment_payment_mismatch" }
  );
});

test("closing accepts a mismatched total when an adjustment reason is given", () => {
  assert.deepEqual(
    evaluateAppointmentClose({
      priceMinor: 300,
      payments: [{ amountMinor: 200 }],
      adjustmentReason: "Скидка постоянному клиенту"
    }),
    { ok: true }
  );
});

test("closing rejects a priced appointment with no payments at all", () => {
  assert.deepEqual(
    evaluateAppointmentClose({ priceMinor: 300, payments: [] }),
    { ok: false, error: "appointment_payment_required" }
  );
});

test("closing a free appointment does not require a payment", () => {
  assert.deepEqual(
    evaluateAppointmentClose({ priceMinor: 0, payments: [] }),
    { ok: true }
  );
});
