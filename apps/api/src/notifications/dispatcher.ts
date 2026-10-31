import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import type { DatabaseClient } from "@danil-nails/db";
import { environment } from "../config.js";
import {
  type AppointmentNotificationPayload,
  isNotificationTemplateCode,
  renderNotification
} from "./templates.js";
import { sendTelegramMessage } from "./telegram-sender.js";
import { sendWhatsAppMessage } from "./whatsapp-sender.js";

const QUEUE_NAME = "notification-dispatch";
const SCAN_INTERVAL_MS = 60_000;
const BATCH_SIZE = 50;

export type NotificationDispatcherHandle = {
  queue: Queue;
  worker: Worker;
  connection: Redis;
};

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

export function startNotificationDispatcher(
  database: DatabaseClient
): NotificationDispatcherHandle | null {
  if (!environment.REDIS_URL) return null;

  const connection = new Redis(environment.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE_NAME, { connection });
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await dispatchDueNotificationJobs(database);
    },
    { connection }
  );
  worker.on("failed", (_job, error) => {
    console.error("[notifications] dispatcher run failed", error);
  });

  void queue.upsertJobScheduler("notification-scan", { every: SCAN_INTERVAL_MS });

  return { queue, worker, connection };
}

export async function stopNotificationDispatcher(
  handle: NotificationDispatcherHandle | null
) {
  if (!handle) return;
  await handle.worker.close();
  await handle.queue.close();
  handle.connection.disconnect();
}
