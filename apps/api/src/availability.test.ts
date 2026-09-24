import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAvailableSlots,
  isDateWithinBookingHorizon
} from "./availability.js";

const date = "2026-09-28";
const localTime = (value: string) => new Date(`${date}T${value}:00+03:00`);
const slotTimes = (slots: Array<{ startsAt: Date }>) =>
  slots.map((slot) => slot.startsAt.toISOString());

test("builds slots around appointments, breaks and additional hours", () => {
  const slots = buildAvailableSlots({
    date,
    workingHours: [{ startsAt: "10:00", endsAt: "14:00" }],
    exceptions: [
      {
        startsAt: localTime("13:00"),
        endsAt: localTime("13:30"),
        isBookable: false
      },
      {
        startsAt: localTime("16:00"),
        endsAt: localTime("18:00"),
        isBookable: true
      }
    ],
    appointments: [
      {
        startsAt: localTime("11:00"),
        endsAt: localTime("12:00"),
        bufferAfterMinutes: 0
      }
    ],
    durationMinutes: 60,
    bufferAfterMinutes: 0,
    now: new Date("2026-09-27T00:00:00.000Z"),
    minimumLeadTimeMinutes: 0,
    slotIntervalMinutes: 30
  });

  assert.deepEqual(slotTimes(slots), [
    localTime("10:00").toISOString(),
    localTime("12:00").toISOString(),
    localTime("16:00").toISOString(),
    localTime("16:30").toISOString(),
    localTime("17:00").toISOString()
  ]);
});

test("keeps service buffer inside working hours", () => {
  const slots = buildAvailableSlots({
    date,
    workingHours: [{ startsAt: "10:00", endsAt: "12:00" }],
    exceptions: [],
    appointments: [],
    durationMinutes: 60,
    bufferAfterMinutes: 30,
    now: new Date("2026-09-27T00:00:00.000Z"),
    minimumLeadTimeMinutes: 0,
    slotIntervalMinutes: 30
  });

  assert.deepEqual(slotTimes(slots), [
    localTime("10:00").toISOString(),
    localTime("10:30").toISOString()
  ]);
});

test("applies minimum booking lead time", () => {
  const slots = buildAvailableSlots({
    date,
    workingHours: [{ startsAt: "10:00", endsAt: "13:00" }],
    exceptions: [],
    appointments: [],
    durationMinutes: 30,
    bufferAfterMinutes: 0,
    now: localTime("09:15"),
    minimumLeadTimeMinutes: 120,
    slotIntervalMinutes: 30
  });

  assert.deepEqual(slotTimes(slots), [
    localTime("11:30").toISOString(),
    localTime("12:00").toISOString(),
    localTime("12:30").toISOString()
  ]);
});

test("keeps multi-day additional hours inside the requested date", () => {
  const slots = buildAvailableSlots({
    date,
    workingHours: [],
    exceptions: [
      {
        startsAt: new Date("2026-09-27T00:00:00+03:00"),
        endsAt: new Date("2026-09-30T00:00:00+03:00"),
        isBookable: true
      }
    ],
    appointments: [],
    durationMinutes: 60,
    bufferAfterMinutes: 0,
    now: new Date("2026-09-27T00:00:00.000Z"),
    minimumLeadTimeMinutes: 0,
    slotIntervalMinutes: 60
  });

  assert.equal(slots.length, 24);
  assert.equal(slots[0]?.startsAt.toISOString(), localTime("00:00").toISOString());
  assert.equal(slots.at(-1)?.startsAt.toISOString(), localTime("23:00").toISOString());
});

test("limits booking dates to the configured horizon", () => {
  const now = new Date("2026-09-28T07:00:00+03:00");

  assert.equal(isDateWithinBookingHorizon("2026-09-28", now), true);
  assert.equal(isDateWithinBookingHorizon("2026-11-27", now), true);
  assert.equal(isDateWithinBookingHorizon("2026-11-28", now), false);
  assert.equal(isDateWithinBookingHorizon("2026-09-27", now), false);
});
