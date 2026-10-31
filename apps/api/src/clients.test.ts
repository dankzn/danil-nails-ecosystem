import assert from "node:assert/strict";
import { test } from "node:test";
import { AppointmentStatus } from "@danil-nails/db";
import { categorizeClient, dayMs } from "./clients.js";

const now = new Date("2026-10-31T12:00:00+03:00");
const daysAgo = (days: number) => new Date(now.getTime() - days * dayMs);

function client(overrides: Partial<Parameters<typeof categorizeClient>[0]> = {}) {
  return {
    id: "client_1",
    createdAt: daysAgo(400),
    isBlocked: false,
    deletedAt: null,
    appointments: [],
    ...overrides
  };
}

test("a client with zero completed visits is never_visited", () => {
  const categories = categorizeClient(client(), now);
  assert.ok(categories.has("never_visited"));
  assert.ok(!categories.has("regular"));
  assert.ok(!categories.has("sleeping"));
  assert.ok(!categories.has("lost"));
});

test("a draft/pending appointment does not count as a visit", () => {
  const categories = categorizeClient(
    client({
      appointments: [
        { startsAt: daysAgo(1), status: AppointmentStatus.pending_admin_confirmation }
      ]
    }),
    now
  );
  assert.ok(categories.has("never_visited"));
});

test("2+ completed visits in the last 3 months is regular", () => {
  const categories = categorizeClient(
    client({
      appointments: [
        { startsAt: daysAgo(10), status: AppointmentStatus.completed },
        { startsAt: daysAgo(40), status: AppointmentStatus.completed }
      ]
    }),
    now
  );
  assert.ok(categories.has("regular"));
  assert.ok(!categories.has("sleeping"));
  assert.ok(!categories.has("lost"));
});

test("one completed visit in the last 3 months is not yet regular", () => {
  const categories = categorizeClient(
    client({
      appointments: [{ startsAt: daysAgo(10), status: AppointmentStatus.completed }]
    }),
    now
  );
  assert.ok(!categories.has("regular"));
  assert.ok(!categories.has("sleeping"));
  assert.ok(!categories.has("lost"));
});

test("last visit between 3 and 6 months ago is sleeping", () => {
  const categories = categorizeClient(
    client({
      appointments: [{ startsAt: daysAgo(120), status: AppointmentStatus.completed }]
    }),
    now
  );
  assert.ok(categories.has("sleeping"));
  assert.ok(!categories.has("lost"));
  assert.ok(!categories.has("regular"));
});

test("last visit more than 6 months ago is lost", () => {
  const categories = categorizeClient(
    client({
      appointments: [{ startsAt: daysAgo(200), status: AppointmentStatus.completed }]
    }),
    now
  );
  assert.ok(categories.has("lost"));
  assert.ok(!categories.has("sleeping"));
});

test("created within the last 7 days is new", () => {
  const categories = categorizeClient(client({ createdAt: daysAgo(2) }), now);
  assert.ok(categories.has("new"));
});

test("created 8 days ago is not new", () => {
  const categories = categorizeClient(client({ createdAt: daysAgo(8) }), now);
  assert.ok(!categories.has("new"));
});

test("a no_show appointment makes the client penalized regardless of other status", () => {
  const categories = categorizeClient(
    client({
      appointments: [{ startsAt: daysAgo(5), status: AppointmentStatus.no_show }]
    }),
    now
  );
  assert.ok(categories.has("penalized"));
  assert.ok(categories.has("never_visited"));
});

test("isBlocked sets blocked independent of visit history", () => {
  const categories = categorizeClient(client({ isBlocked: true }), now);
  assert.ok(categories.has("blocked"));
});

test("a deleted client is only deleted, nothing else", () => {
  const categories = categorizeClient(
    client({
      deletedAt: daysAgo(1),
      isBlocked: true,
      createdAt: daysAgo(1),
      appointments: [{ startsAt: daysAgo(1), status: AppointmentStatus.completed }]
    }),
    now
  );
  assert.deepEqual([...categories], ["deleted"]);
});
