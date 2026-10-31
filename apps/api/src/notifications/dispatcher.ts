import type { DatabaseClient } from "@danil-nails/db";
import {
  type AppointmentNotificationPayload,
  isNotificationTemplateCode,
  renderNotification
} from "./templates.js";
import { sendTelegramMessage } from "./telegram-sender.js";
import { sendWhatsAppMessage } from "./whatsapp-sender.js";

const BATCH_SIZE = 50;

// apps/api runs as a Vercel serverless function in production, so there is
// no persistent process to host a BullMQ worker. This function instead runs
// once per call to POST /v1/internal/notifications/dispatch (see
// routes/notifications.ts), which an external scheduler — currently
// .github/workflows/dispatch-notifications.yml — pings every few minutes.
export async function dispatchDueNotificationJobs(database: DatabaseClient) {
  const due = await database.notificationJob.findMany({
    where: { scheduledAt: { lte: new Date() }, sentAt: null, failedAt: null },
    orderBy: { scheduledAt: "asc" },
    take: BATCH_SIZE
  });

  for (const job of due) {
    try {
      if (!isNotificationTemplateCode(job.templateCode)) {
        throw new Error(`unknown_template_code: ${job.templateCode}`);
      }
      const text = renderNotification(
        job.templateCode,
        job.payload as unknown as AppointmentNotificationPayload
      );

      if (job.channel === "telegram") {
        await sendTelegramMessage(job.recipient, text);
      } else if (job.channel === "whatsapp") {
        await sendWhatsAppMessage(job.recipient, text);
      } else {
        throw new Error(`unknown_channel: ${job.channel}`);
      }

      await database.notificationJob.update({
        where: { id: job.id },
        data: { sentAt: new Date() }
      });
    } catch (error) {
      await database.notificationJob.update({
        where: { id: job.id },
        data: {
          failedAt: new Date(),
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  return due.length;
}
