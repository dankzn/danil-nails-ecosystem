import { environment } from "../config.js";

// Built so WhatsApp sending is ready to flip on the moment a Spanish
// business phone number is registered with WhatsApp Cloud API — until then
// WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID stay unset, this throws, and
// the dispatcher records it on the job as a failed send rather than crashing.
export async function sendWhatsAppMessage(phone: string, text: string) {
  if (!environment.WHATSAPP_ACCESS_TOKEN || !environment.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("whatsapp_not_configured");
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${environment.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${environment.WHATSAPP_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone.replace(/[^\d]/g, ""),
        type: "text",
        text: { body: text }
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`whatsapp_send_failed: ${response.status} ${body}`);
  }
}
