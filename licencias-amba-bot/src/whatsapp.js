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



function getAuth() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID");
  return { token, phoneNumberId };
}

export async function sendButtonsMessage({ to, body, buttons }) {
  const { token, phoneNumberId } = getAuth();
  const url = `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: {
            id: b.id,
            title: String(b.title).slice(0, 20)
          }
        }))
      }
    }
  };

  await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  });
}

export async function sendListMessage({ to, body, buttonText, sections }) {
  const { token, phoneNumberId } = getAuth();
  const url = `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: String(buttonText || "Elegir").slice(0, 20),
        sections: sections.map((s) => ({
          title: String(s.title).slice(0, 24),
          rows: s.rows.slice(0, 10).map((r) => ({
            id: r.id,
            title: String(r.title).slice(0, 24),
            description: String(r.description || "").slice(0, 72)
          }))
        }))
      }
    }
  };

  await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  });
}
