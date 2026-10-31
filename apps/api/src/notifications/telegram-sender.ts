import { environment } from "../config.js";

export async function sendTelegramMessage(chatId: string, text: string) {
  if (!environment.TELEGRAM_BOT_TOKEN) {
    throw new Error("telegram_not_configured");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${environment.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`telegram_send_failed: ${response.status} ${body}`);
  }
}
