import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sendLeadEmail } from "./mailer.js";

import { sendTextMessage, sendButtonsMessage, sendListMessage } from "./whatsapp.js";
import { parseIncomingMessage } from "./parser.js";
import { initialSession, nextMessage } from "./flow.js";
import { redis } from "./redis.js";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const PORT = process.env.PORT || 3000;

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 horas
const DEDUPE_TTL_SECONDS = 60 * 10; // 10 minutos

function normalizeTo(to) {
  if (typeof to === "string" && to.startsWith("54911")) {
    return "541115" + to.slice("54911".length);
  }
  return to;
}

function buildWhatsAppLink(originLabel) {
  const phone = process.env.SITE_WHATSAPP_PHONE || process.env.OPERATOR_PHONE;
  const base = "Hola, quiero evaluar mi caso por restricción de licencia.";
  const origin = originLabel ? ` (Origen: sitio web - ${originLabel})` : "";
  const text = encodeURIComponent(base + origin);

  if (!phone) return "#";
  const digits = String(phone).replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${text}`;
}

async function sendOut(to, out) {
  if (out.action === "REPLY_TEXT") {
    return sendTextMessage({ to, text: out.message });
  }

  if (out.action === "REPLY_BUTTONS") {
    return sendButtonsMessage({ to, body: out.body, buttons: out.buttons });
  }

  if (out.action === "REPLY_LIST") {
    return sendListMessage({
      to,
      body: out.body,
      buttonText: out.buttonText,
      sections: out.sections,
    });
  }

  throw new Error(`Acción no soportada: ${out.action}`);
}

function sessionKey(wa_id) {
  return `session:${wa_id}`;
}

function messageKey(messageId) {
  return `msg:${messageId}`;
}

async function getSession(wa_id) {
  return await redis.get(sessionKey(wa_id));
}

async function setSession(wa_id, session) {
  await redis.set(sessionKey(wa_id), session, { ex: SESSION_TTL_SECONDS });
}

async function deleteSession(wa_id) {
  await redis.del(sessionKey(wa_id));
}

async function getOrCreateSession(wa_id) {
  let session = await getSession(wa_id);

  if (!session) {
    session = initialSession();
    await setSession(wa_id, session);
  }

  return session;
}

async function isDuplicateMessage(messageId) {
  if (!messageId) return false;

  const key = messageKey(messageId);
  const alreadyProcessed = await redis.get(key);

  if (alreadyProcessed) {
    return true;
  }

  await redis.set(key, "1", { ex: DEDUPE_TTL_SECONDS });
  return false;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (_req, res) => {
  res.render("inicio", { whatsappLink: buildWhatsAppLink("Inicio") });
});

app.get("/derechos", (_req, res) => {
  res.render("derechos", { whatsappLink: buildWhatsAppLink("Derechos") });
});

app.get("/faq", (_req, res) => {
  res.render("faq", { whatsappLink: buildWhatsAppLink("FAQ") });
});

app.get("/contacto", (_req, res) => {
  res.render("contacto", { whatsappLink: buildWhatsAppLink("Contacto") });
});

app.get("/health", async (_req, res) => {
  try {
    await redis.ping();
    res.send("OK - bot up - redis connected");
  } catch (error) {
    console.error("Healthcheck Redis error:", error);
    res.status(500).send("Redis not available");
  }
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("✅ Meta verificó el webhook correctamente");
    return res.status(200).send(challenge);
  }

  console.log("❌ Intento de verificación fallido", { mode, token });
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const parsed = parseIncomingMessage(req.body);
    if (!parsed) return;

    const { wa_id, text, messageId } = parsed;
    if (!wa_id) return;

    if (/hola|menu|menú|reiniciar|reset/i.test(text)) {
      await deleteSession(wa_id);
    }

    if (await isDuplicateMessage(messageId)) {
      console.log("DUPLICATE IGNORED:", { wa_id, text, messageId });
      return;
    }

    const session = await getOrCreateSession(wa_id);

    console.log("IN:", { wa_id, text, messageId, prevState: session?.state });

    const out = nextMessage({ text, wa_id, session });

    await setSession(wa_id, session);

    console.log("OUT:", { wa_id, newState: session?.state, action: out?.action });

    const toUser = normalizeTo(wa_id);

    if (out.action === "DROP") {
      await sendOut(toUser, { action: "REPLY_TEXT", message: out.message });
      await deleteSession(wa_id);
      return;
    }

    if (out.action === "HANDOFF") {
      await sendOut(toUser, { action: "REPLY_TEXT", message: out.message });

      const lead = {
        nombre: session.data.clientName,
        telefono: wa_id,
        localidad: session.data.municipality,
        situacion: `Restricción por multas - ${session.data.debtBucket || "SIN DATO"}`,
        detalle: out.operatorSummary,
      };

      try {
        console.log("EMAIL LEAD PREPARED:", lead);
        await sendLeadEmail(lead);
        console.log("EMAIL LEAD SENT:", {
          wa_id,
          to: process.env.EMAIL_TO,
        });
      } catch (error) {
        console.error("EMAIL LEAD FAILED:", {
          wa_id,
          error: error?.message || error,
        });
      }

      if (process.env.OPERATOR_PHONE) {
        try {
          const toOp = normalizeTo(process.env.OPERATOR_PHONE);
          await sendTextMessage({ to: toOp, text: out.operatorSummary });
          console.log("WHATSAPP LEAD SENT:", { wa_id, toOp });
        } catch (error) {
          console.error("WHATSAPP LEAD FAILED:", {
            wa_id,
            operatorPhone: process.env.OPERATOR_PHONE,
            error: error?.response?.data || error?.message,
          });
        }
      } else {
        console.warn("WHATSAPP LEAD SKIPPED: falta OPERATOR_PHONE");
      }

      await deleteSession(wa_id);
      return;
    }
    await sendOut(toUser, out);
  } catch (e) {
    console.error("Error en webhook:", e);
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

export default app;