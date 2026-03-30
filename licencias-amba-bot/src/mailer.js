import "dotenv/config";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

export async function sendLeadEmail(lead) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: "Nuevo lead - Defensa Licencias",
    text: `
Nuevo lead recibido

Nombre: ${lead.nombre || ""}
Teléfono: ${lead.telefono || ""}
Localidad: ${lead.localidad || ""}
Situación: ${lead.situacion || ""}
Detalle: ${lead.detalle || ""}
    `,
  };

  await transporter.sendMail(mailOptions);
}