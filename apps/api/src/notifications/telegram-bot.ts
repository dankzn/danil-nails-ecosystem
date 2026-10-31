import { Bot, Keyboard } from "grammy";
import type { DatabaseClient } from "@danil-nails/db";
import { environment } from "../config.js";
import { normalizePhone } from "../routes/clients.js";
import { resolveTelegramLocale, telegramBotMessages } from "./templates.js";

export function createTelegramBot(database: DatabaseClient): Bot | null {
  if (!environment.TELEGRAM_BOT_TOKEN) return null;

  const bot = new Bot(environment.TELEGRAM_BOT_TOKEN);

  bot.command("start", async (ctx) => {
    const locale = resolveTelegramLocale(ctx.from?.language_code);
    const keyboard = new Keyboard()
      .requestContact(telegramBotMessages.shareButton[locale])
      .resized()
      .oneTime();
    await ctx.reply(telegramBotMessages.start[locale], { reply_markup: keyboard });
  });

  bot.on("message:contact", async (ctx) => {
    const locale = resolveTelegramLocale(ctx.from.language_code);
    const contact = ctx.message.contact;

    if (contact.user_id && contact.user_id !== ctx.from.id) {
      await ctx.reply(telegramBotMessages.mismatch[locale]);
      return;
    }

    const phone = normalizePhone(contact.phone_number.replace(/^(?!\+)/, "+"));
    const client = await database.client.findUnique({ where: { phone } });

    if (!client) {
      await ctx.reply(telegramBotMessages.notFound[locale]);
      return;
    }

    await database.client.update({
      where: { id: client.id },
      data: {
        telegramChatId: String(ctx.chat.id),
        telegramUsername: ctx.from.username ?? null
      }
    });
    await ctx.reply(telegramBotMessages.linked[client.preferredLanguage]);
  });

  bot.catch((error) => {
    console.error("[telegram-bot] unhandled error", error);
  });

  return bot;
}

export async function startTelegramBot(database: DatabaseClient): Promise<Bot | null> {
  const bot = createTelegramBot(database);
  if (!bot) return null;

  bot
    .start({
      drop_pending_updates: true,
      onStart: () => console.log("[telegram-bot] started")
    })
    .catch((error) => console.error("[telegram-bot] polling stopped with an error", error));

  return bot;
}

export async function stopTelegramBot(bot: Bot | null) {
  await bot?.stop();
}
