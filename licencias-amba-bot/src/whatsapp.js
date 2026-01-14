import axios from "axios";

export async function sendTextMessage({ to, text }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error("Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en .env");
  }

  if (!to) {
    throw new Error("sendTextMessage: falta 'to'");
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error(`sendTextMessage: 'text' inválido (${String(text)})`);
  }

  const url = `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text }
  };

  await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
}
