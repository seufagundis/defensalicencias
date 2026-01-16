import express from "express";
import dotenv from "dotenv";
import path from "path";

import { sendTextMessage, sendButtonsMessage, sendListMessage } from "./whatsapp.js";

import { parseIncomingMessage } from "./parser.js";
import { initialSession, nextMessage } from "./flow.js";

dotenv.config();

const app = express();

// Vistas (sitio web)
app.set("views", path.join(process.cwd(), "src", "views"));
app.set("view engine", "ejs");


const PORT = process.env.PORT || 3000;


// 54911XXXXXXXX -> 541115XXXXXXXX (para envío en modo test AR)
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

  // Si te olvidaste de mapear una acción nueva, que explote con mensaje claro:
  throw new Error(`Acción no soportada: ${out.action}`);
}


app.use(express.json());

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


// Healthcheck
app.get("/", (_req, res) => res.send("OK - bot up"));

// Verificación webhook (GET)
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

// Sessions in-memory
const sessions = new Map(); // wa_id -> session

// Recepción eventos (POST)
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    // Tu parser actual (ajustá si devuelve otro shape)
    const parsed = parseIncomingMessage(req.body);
    if (!parsed) return;

    const wa_id = parsed.wa_id;
    const text = parsed.text;

    if (!wa_id) return;

    let session = sessions.get(wa_id);
    if (!session) {
      session = initialSession();
      sessions.set(wa_id, session);
    }



    console.log("IN:", { wa_id, text, prevState: session?.state });
    const out = nextMessage({ text, wa_id, session });
    sessions.set(wa_id, session);


    console.log("OUT:", { wa_id, newState: session?.state, action: out?.action });


    const toUser = normalizeTo(wa_id);

    if (out.action === "DROP") {
      await sendOut(toUser, { action: "REPLY_TEXT", message: out.message });
      sessions.delete(wa_id);
      return;
    }


    if (out.action === "HANDOFF") {
      await sendOut(toUser, { action: "REPLY_TEXT", message: out.message });

      if (process.env.OPERATOR_PHONE) {
        const toOp = normalizeTo(process.env.OPERATOR_PHONE);
        await sendTextMessage({ to: toOp, text: out.operatorSummary });
      }

      sessions.delete(wa_id);
      return;
    }


    // REPLY
    await sendOut(toUser, out);

  } catch (e) {
    console.error("Error en webhook:", e);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
