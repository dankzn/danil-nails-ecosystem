import type { DatabaseClient } from "@danil-nails/db";
import { startNotificationDispatcher, stopNotificationDispatcher } from "./dispatcher.js";
import { startTelegramBot, stopTelegramBot } from "./telegram-bot.js";

export {
  cancelPendingReminder,
  queueAppointmentCancellation,
  queueAppointmentConfirmation,
  queueAppointmentReminder,
  resolveClientChannel
} from "./jobs.js";

export async function startNotifications(database: DatabaseClient) {
  const bot = await startTelegramBot(database);
  const dispatcher = startNotificationDispatcher(database);

  return async function stopNotifications() {
    await stopTelegramBot(bot);
    await stopNotificationDispatcher(dispatcher);
  };
}
