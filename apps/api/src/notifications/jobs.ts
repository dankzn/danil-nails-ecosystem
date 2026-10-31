import { type DatabaseClient, type Prisma, Locale } from "@danil-nails/db";
import { bookingRules } from "@danil-nails/shared";
import type { AppointmentNotificationPayload, NotificationTemplateCode } from "./templates.js";

type NotificationDb = DatabaseClient | Prisma.TransactionClient;

type NotificationChannel = "telegram" | "whatsapp";

export function resolveClientChannel(client: {
  telegramChatId: string | null;
  whatsappPhone: string | null;
}): { channel: NotificationChannel; recipient: string } | null {
  if (client.telegramChatId) {
    return { channel: "telegram", recipient: client.telegramChatId };
  }
  if (client.whatsappPhone) {
    return { channel: "whatsapp", recipient: client.whatsappPhone };
  }
  return null;
}

type AppointmentForNotification = {
  id: string;
  startsAt: Date;
  service: { titleRu: string };
  staff: { displayName: string };
};

type ClientForNotification = {
  telegramChatId: string | null;
  whatsappPhone: string | null;
  preferredLanguage: Locale;
};

function buildPayload(
  appointment: AppointmentForNotification,
  client: ClientForNotification
): AppointmentNotificationPayload {
  return {
    appointmentId: appointment.id,
    locale: client.preferredLanguage,
    serviceTitle: appointment.service.titleRu,
    staffName: appointment.staff.displayName,
    startsAt: appointment.startsAt.toISOString()
  };
}

async function queue(
  db: NotificationDb,
  templateCode: NotificationTemplateCode,
  scheduledAt: Date,
  channelInfo: { channel: NotificationChannel; recipient: string },
  payload: AppointmentNotificationPayload
) {
  await db.notificationJob.create({
    data: {
      channel: channelInfo.channel,
      recipient: channelInfo.recipient,
      templateCode,
      payload,
      scheduledAt
    }
  });
}

export async function queueAppointmentConfirmation(
  db: NotificationDb,
  appointment: AppointmentForNotification,
  client: ClientForNotification
) {
  const channelInfo = resolveClientChannel(client);
  if (!channelInfo) return;
  await queue(
    db,
    "booking_confirmation",
    new Date(),
    channelInfo,
    buildPayload(appointment, client)
  );
}

export async function queueAppointmentReminder(
  db: NotificationDb,
  appointment: AppointmentForNotification,
  client: ClientForNotification
) {
  const channelInfo = resolveClientChannel(client);
  if (!channelInfo) return;
  const scheduledAt = new Date(
    appointment.startsAt.getTime() -
      bookingRules.clientReminderMinutesBeforeAppointment * 60_000
  );
  if (scheduledAt.getTime() <= Date.now()) return;
  await queue(
    db,
    "booking_reminder",
    scheduledAt,
    channelInfo,
    buildPayload(appointment, client)
  );
}

export async function queueAppointmentCancellation(
  db: NotificationDb,
  appointment: AppointmentForNotification,
  client: ClientForNotification
) {
  const channelInfo = resolveClientChannel(client);
  if (!channelInfo) return;
  await queue(
    db,
    "booking_canceled",
    new Date(),
    channelInfo,
    buildPayload(appointment, client)
  );
}

// Marks a still-pending reminder as failed (rather than deleting it) so it
// never gets sent and the workspace's notification history keeps a record
// of why it didn't go out.
export async function cancelPendingReminder(db: NotificationDb, appointmentId: string) {
  await db.notificationJob.updateMany({
    where: {
      templateCode: "booking_reminder",
      sentAt: null,
      failedAt: null,
      payload: { path: ["appointmentId"], equals: appointmentId }
    },
    data: { failedAt: new Date(), error: "appointment_canceled" }
  });
}
