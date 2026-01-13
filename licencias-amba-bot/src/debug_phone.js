// src/debug_phone.js
import dotenv from "dotenv";
dotenv.config();

const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const token = process.env.WHATSAPP_TOKEN;

const url = `https://graph.facebook.com/v24.0/${phoneNumberId}?fields=display_phone_number,verified_name`;

const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
console.log("status:", r.status);
console.log(await r.text());
