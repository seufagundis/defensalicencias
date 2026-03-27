import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v24.0";

if (!TOKEN) {
  throw new Error("Falta WHATSAPP_TOKEN en el entorno.");
}

if (!PHONE_NUMBER_ID) {
  throw new Error("Falta WHATSAPP_PHONE_NUMBER_ID en el entorno.");
}

const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

function trimText(value, max) {
  return String(value ?? "").slice(0, max);
}

function logSendSuccess(kind, to, response) {
  const messageId = response?.data?.messages?.[0]?.id;
  console.log(`[WA:SENT] type=${kind} to=${to} messageId=${messageId || "n/a"}`);
}

function extractAxiosError(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const metaError = data?.error;

  return {
    status: status || null,
    message: metaError?.message || error?.message || "Error desconocido",
    code: metaError?.code || null,
    type: metaError?.type || null,
    fbtrace_id: metaError?.fbtrace_id || null,
    raw: data || null,
  };
}

function logSendError(kind, to, error) {
  const info = extractAxiosError(error);

  console.error(`[WA:ERROR] type=${kind} to=${to}`);
  console.error({
    status: info.status,
    message: info.message,
    code: info.code,
    type: info.type,
    fbtrace_id: info.fbtrace_id,
    raw: info.raw,
  });
}

async function postToWhatsApp(payload, kind) {
  const to = payload?.to;

  try {
    const response = await axios.post(GRAPH_URL, payload, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    logSendSuccess(kind, to, response);
    return response.data;
  } catch (error) {
    logSendError(kind, to, error);
    throw error;
  }
}

export async function sendTextMessage({ to, text }) {
  if (!to) {
    throw new Error("sendTextMessage: falta 'to'.");
  }

  if (!text || !String(text).trim()) {
    throw new Error("sendTextMessage: falta 'text'.");
  }

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      body: String(text),
    },
  };

  return postToWhatsApp(payload, "text");
}

export async function sendButtonsMessage({ to, body, buttons }) {
  if (!to) {
    throw new Error("sendButtonsMessage: falta 'to'.");
  }

  if (!body || !String(body).trim()) {
    throw new Error("sendButtonsMessage: falta 'body'.");
  }

  if (!Array.isArray(buttons) || buttons.length === 0) {
    throw new Error("sendButtonsMessage: 'buttons' debe ser un array no vacío.");
  }

  const interactiveButtons = buttons.slice(0, 3).map((btn) => ({
    type: "reply",
    reply: {
      id: String(btn.id),
      title: trimText(btn.title, 20),
    },
  }));

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: String(body),
      },
      action: {
        buttons: interactiveButtons,
      },
    },
  };

  return postToWhatsApp(payload, "buttons");
}

export async function sendListMessage({ to, body, buttonText, sections }) {
  if (!to) {
    throw new Error("sendListMessage: falta 'to'.");
  }

  if (!body || !String(body).trim()) {
    throw new Error("sendListMessage: falta 'body'.");
  }

  if (!buttonText || !String(buttonText).trim()) {
    throw new Error("sendListMessage: falta 'buttonText'.");
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error("sendListMessage: 'sections' debe ser un array no vacío.");
  }

  const normalizedSections = sections.map((section) => ({
    title: trimText(section.title, 24),
    rows: (section.rows || []).slice(0, 10).map((row) => ({
      id: String(row.id),
      title: trimText(row.title, 24),
      description: row.description ? trimText(row.description, 72) : undefined,
    })),
  }));

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: String(body),
      },
      action: {
        button: trimText(buttonText, 20),
        sections: normalizedSections,
      },
    },
  };

  return postToWhatsApp(payload, "list");
}