import { Bot, Keyboard, webhookCallback } from "grammy";
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

// apps/api runs as a Vercel serverless function in production (see
// api/index.ts) — there is no persistent process for long-polling, so the
// bot is driven by a Telegram webhook instead. bot.init() needs one network
// call to Telegram (getMe) before handleUpdate will work; doing that here,
// once per cold start when this route is registered, rather than per
// request, keeps steady-state requests fast.
export async function createTelegramWebhookHandler(database: DatabaseClient) {
  const bot = createTelegramBot(database);
  if (!bot) return null;

  try {
    await bot.init();
  } catch (error) {
    console.error("[telegram-bot] failed to initialize — webhook stays disabled", error);
    return null;
  }

  if (!environment.TELEGRAM_WEBHOOK_SECRET) {
    console.warn(
      "[telegram-bot] TELEGRAM_WEBHOOK_SECRET is not set — the webhook endpoint will accept unsigned requests"
    );
  }

  return webhookCallback(bot, "fastify", {
    ...(environment.TELEGRAM_WEBHOOK_SECRET
      ? { secretToken: environment.TELEGRAM_WEBHOOK_SECRET }
      : {})
  });
}

// Tells Telegram where to deliver updates. This is a one-off setup call
// (idempotent — re-running it just overwrites the same URL), meant to be
// triggered once after TELEGRAM_BOT_TOKEN/APP_PUBLIC_URL/
// TELEGRAM_WEBHOOK_SECRET are configured and deployed, not on every cold
// start.
export async function registerTelegramWebhook(database: DatabaseClient) {
  if (!environment.TELEGRAM_BOT_TOKEN) {
    return { ok: false as const, error: "telegram_not_configured" };
  }

  const bot = createTelegramBot(database);
  if (!bot) return { ok: false as const, error: "telegram_not_configured" };

  const webhookUrl = `${environment.APP_PUBLIC_URL}/v1/telegram/webhook`;

  try {
    await bot.api.setWebhook(webhookUrl, {
      drop_pending_updates: true,
      ...(environment.TELEGRAM_WEBHOOK_SECRET
        ? { secret_token: environment.TELEGRAM_WEBHOOK_SECRET }
        : {})
    });
    return { ok: true as const, url: webhookUrl };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
