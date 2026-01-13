import dotenv from "dotenv";
dotenv.config();

console.log("TOKEN len:", process.env.WHATSAPP_TOKEN?.length);
console.log("PHONE_ID:", process.env.WHATSAPP_PHONE_NUMBER_ID);
console.log("VERIFY:", process.env.WHATSAPP_VERIFY_TOKEN);


const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const token = process.env.WHATSAPP_TOKEN;

const to = "54111526964066";

async function main() {
  const url = `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: "Prueba desde Node (sin curl)" },
    }),
  });

  const data = await resp.json();
  console.log("status:", resp.status);
  console.log("data:", JSON.stringify(data, null, 2));
}

main().catch((e) => console.error(e));
