import "dotenv/config";
import { sendLeadEmail } from "./src/mailer.js";

async function main() {
  try {
    await sendLeadEmail({
      nombre: "Prueba",
      telefono: "5491112345678",
      localidad: "San Isidro",
      situacion: "Multas impagas",
      detalle: "Esto es una prueba",
    });

    console.log("Mail enviado correctamente");
  } catch (error) {
    console.error("Error al enviar mail:");
    console.error(error);
  }
}

main();