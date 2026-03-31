import "dotenv/config";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendLeadEmail(lead) {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM,
    to: [process.env.EMAIL_TO],
    subject: "Nuevo lead - Defensa Licencias",
    text: `Nuevo lead recibido

Nombre: ${lead.nombre || ""}
Teléfono: ${lead.telefono || ""}
Localidad: ${lead.localidad || ""}
Situación: ${lead.situacion || ""}
Detalle: ${lead.detalle || ""}
`,
  });

  if (error) {
    throw new Error(error.message || "Resend error");
  }

  return data;
}