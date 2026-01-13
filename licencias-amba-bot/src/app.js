import express from "express";
import dotenv from "dotenv";
import { parseIncomingMessage } from "./parser.js";
import { sendTextMessage } from "./whatsapp.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

function normalizeTo(to) {
  // Caso CABA/GBA: 54911XXXXXXXX -> 541115XXXXXXXX
  if (typeof to === "string" && to.startsWith("54911")) {
    return "541115" + to.slice("54911".length);
  }
  return to;
}

// IMPORTANTE: Meta manda JSON
app.use(express.json());

// Healthcheck
app.get("/", (_req, res) => res.send("OK - bot up"));

// 1) Verificación del webhook (Meta hace GET al verificar)
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

// 2) Recepción de eventos (Meta hace POST por cada evento)

app.post("/webhook", async (req, res) => {
  console.log("📩 EVENTO WHATSAPP (RAW):");
  console.log(JSON.stringify(req.body, null, 2));

  res.sendStatus(200);

  try {
    const message = parseIncomingMessage(req.body);
    if (!message) {
      console.log("ℹ️ Evento sin messages (puede ser status u otro tipo).");
      return;
    }

    const { wa_id, text } = message;
    const to = normalizeTo(wa_id);

    console.log("➡️ Respondiendo a:", to, "(wa_id:", wa_id, ")");

    if (!text) {
      await sendTextMessage({
        to,
        text: "Recibí tu mensaje, pero necesito texto. Escribime tu consulta."
      });
      return;
    }

    await sendTextMessage({
      to,
      text: `Eco: ${text}`
    });

  } catch (err) {
    console.error("🔥 Error procesando webhook:", err?.response?.data || err);
  }
});



app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
