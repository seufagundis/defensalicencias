import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

async function main() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Tu número personal (el que va a recibir el mensaje de prueba)
  // Formato: código país + número, sin + ni espacios. Ej: 54911XXXXXXXX
  const to = "54111526964066";

  if (!token || !phoneNumberId) {
    throw new Error("Falta WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en .env");
  }

  const url = `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: "Hola! Mensaje de prueba desde mi bot (Cloud API) ✅" }
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  console.log("Enviado OK. Respuesta:", res.data);
}

main().catch((err) => {
  console.error("Error:", err?.response?.data || err.message);
  process.exit(1);
});
