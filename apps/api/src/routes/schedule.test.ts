import assert from "node:assert/strict";
import test from "node:test";
import { findAppointmentOutsideRanges, hasInvalidWorkingHours } from "./schedule.js";

const at = (time: string) => new Date(`2026-10-30T${time}:00+03:00`);

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

test("findAppointmentOutsideRanges flags an appointment when the day is made off (no ranges)", () => {
  const appointment = { startsAt: at("11:00"), endsAt: at("12:30") };
  const found = findAppointmentOutsideRanges([appointment], []);
  assert.equal(found, appointment);
});

test("findAppointmentOutsideRanges allows a day-override that still covers every appointment", () => {
  const appointment = { startsAt: at("11:00"), endsAt: at("12:30") };
  const found = findAppointmentOutsideRanges(
    [appointment],
    [{ startsAt: at("09:00"), endsAt: at("18:00") }]
  );
  assert.equal(found, undefined);
});

test("findAppointmentOutsideRanges flags an appointment narrowed out of the new hours", () => {
  const appointment = { startsAt: at("17:00"), endsAt: at("18:30") };
  const found = findAppointmentOutsideRanges(
    [appointment],
    [{ startsAt: at("09:00"), endsAt: at("17:00") }]
  );
  assert.equal(found, appointment);
});

test("findAppointmentOutsideRanges allows an appointment that fits inside a break-split range", () => {
  const appointment = { startsAt: at("15:00"), endsAt: at("16:00") };
  const found = findAppointmentOutsideRanges(
    [appointment],
    [
      { startsAt: at("09:00"), endsAt: at("13:00") },
      { startsAt: at("14:00"), endsAt: at("18:00") }
    ]
  );
  assert.equal(found, undefined);
});
