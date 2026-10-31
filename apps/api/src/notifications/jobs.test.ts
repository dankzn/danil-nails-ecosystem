import assert from "node:assert/strict";
import { test } from "node:test";
import type { DatabaseClient } from "@danil-nails/db";
import {
  cancelPendingReminder,
  queueAppointmentCancellation,
  queueAppointmentConfirmation,
  queueAppointmentReminder,
  resolveClientChannel
} from "./jobs.js";

function fakeDatabase() {
  const created: Array<Record<string, unknown>> = [];
  const updateManyCalls: Array<Record<string, unknown>> = [];
  const db = {
    notificationJob: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return data;
      },
      updateMany: async (args: Record<string, unknown>) => {
        updateManyCalls.push(args);
        return { count: 1 };
      }
    }
  };
  return { db: db as unknown as DatabaseClient, created, updateManyCalls };
}

const appointment = {
  id: "appt_1",
  startsAt: new Date("2026-11-10T09:00:00.000Z"),
  service: { titleRu: "Маникюр с покрытием" },
  staff: { displayName: "Аида" }
};

test("resolveClientChannel prefers telegram over whatsapp when both are set", () => {
  assert.deepEqual(
    resolveClientChannel({ telegramChatId: "123", whatsappPhone: "+79990000000" }),
    { channel: "telegram", recipient: "123" }
  );
});

test("resolveClientChannel falls back to whatsapp when telegram isn't linked", () => {
  assert.deepEqual(resolveClientChannel({ telegramChatId: null, whatsappPhone: "+79990000000" }), {
    channel: "whatsapp",
    recipient: "+79990000000"
  });
});

test("resolveClientChannel returns null when no channel is available", () => {
  assert.equal(resolveClientChannel({ telegramChatId: null, whatsappPhone: null }), null);
});

test("queueAppointmentConfirmation does nothing when the client has no linked channel", async () => {
  const { db, created } = fakeDatabase();
  await queueAppointmentConfirmation(db, appointment, {
    telegramChatId: null,
    whatsappPhone: null,
    preferredLanguage: "ru"
  });
  assert.equal(created.length, 0);
});

test("queueAppointmentConfirmation queues an immediate job for a linked client", async () => {
  const { db, created } = fakeDatabase();
  await queueAppointmentConfirmation(db, appointment, {
    telegramChatId: "123",
    whatsappPhone: null,
    preferredLanguage: "es"
  });
  assert.equal(created.length, 1);
  assert.equal(created[0]!.channel, "telegram");
  assert.equal(created[0]!.templateCode, "booking_confirmation");
  assert.equal((created[0]!.payload as { locale: string }).locale, "es");
});

test("queueAppointmentReminder schedules 60 minutes before the appointment", async () => {
  const { db, created } = fakeDatabase();
  await queueAppointmentReminder(
    db,
    { ...appointment, startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000) },
    { telegramChatId: "123", whatsappPhone: null, preferredLanguage: "ru" }
  );
  assert.equal(created.length, 1);
  const job = created[0]! as { scheduledAt: Date; templateCode: string };
  assert.equal(job.templateCode, "booking_reminder");
  const expected = Date.now() + 60 * 60 * 1000;
  assert.ok(Math.abs(job.scheduledAt.getTime() - expected) < 5000);
});

test("queueAppointmentReminder skips appointments starting too soon to remind about", async () => {
  const { db, created } = fakeDatabase();
  await queueAppointmentReminder(
    db,
    { ...appointment, startsAt: new Date(Date.now() + 5 * 60 * 1000) },
    { telegramChatId: "123", whatsappPhone: null, preferredLanguage: "ru" }
  );
  assert.equal(created.length, 0);
});

test("queueAppointmentCancellation does nothing without a linked channel", async () => {
  const { db, created } = fakeDatabase();
  await queueAppointmentCancellation(db, appointment, {
    telegramChatId: null,
    whatsappPhone: null,
    preferredLanguage: "ru"
  });
  assert.equal(created.length, 0);
});

test("cancelPendingReminder fails out only the matching appointment's pending reminder", async () => {
  const { db, updateManyCalls } = fakeDatabase();
  await cancelPendingReminder(db, "appt_1");
  assert.equal(updateManyCalls.length, 1);
  const where = updateManyCalls[0]!.where as Record<string, unknown>;
  assert.equal(where.templateCode, "booking_reminder");
  assert.deepEqual(where.payload, { path: ["appointmentId"], equals: "appt_1" });
});
