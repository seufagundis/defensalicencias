import express from "express";
import dotenv from "dotenv";

import { parseIncomingMessage } from "./parser.js";
import { sendTextMessage } from "./whatsapp.js";
import { initialSession, nextMessage } from "./flow.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 54911XXXXXXXX -> 541115XXXXXXXX (para envío en modo test AR)
function normalizeTo(to) {
  if (typeof to === "string" && to.startsWith("54911")) {
    return "541115" + to.slice("54911".length);
  }
  return to;
}

app.use(express.json());

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

    const out = nextMessage({ text, wa_id, session });

    const toUser = normalizeTo(wa_id);

    if (out.action === "DROP") {
await sendTextMessage({ to: toUser, text: out.message });
      sessions.delete(wa_id);
      return;
    }

    if (out.action === "HANDOFF") {
      // 1) Mensaje al cliente
await sendTextMessage({ to: toUser, text: out.message });

      // 2) Mensaje al operador (normalizado también)
      if (process.env.OPERATOR_PHONE) {
        const toOp = normalizeTo(process.env.OPERATOR_PHONE);
await sendTextMessage({ to: toOp, text: out.operatorSummary });
      }

      sessions.delete(wa_id);
      return;
    }

    // REPLY
await sendTextMessage({ to: toUser, text: out.message });
  } catch (e) {
    console.error("Error en webhook:", e);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
