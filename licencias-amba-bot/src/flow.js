// src/flow.js

const STATES = {
  START: "START",
  Q1_AREA: "Q1_AREA",
  Q2_DEBT: "Q2_DEBT",
  Q2_DEBT_FREE: "Q2_DEBT_FREE", // cuando no sabe monto
  Q3_LICENSE: "Q3_LICENSE",
  GET_CLIENT_NAME: "GET_CLIENT_NAME",
  GET_CLIENT_DNI: "GET_CLIENT_DNI",
  GET_CLIENT_ADDRESS: "GET_CLIENT_ADDRESS",
  GET_FINE_AMOUNT: "GET_FINE_AMOUNT",
  GET_FINE_COUNT: "GET_FINE_COUNT",
  GET_FINE_JURIS: "GET_FINE_JURIS",
  GET_FINE_DUE: "GET_FINE_DUE",
  QUOTE_AND_CONFIRM: "QUOTE_AND_CONFIRM",
  CONSENT: "CONSENT",
  DONE: "DONE",
  DROPPED: "DROPPED",
};

function initialSession() {
  return {
    state: STATES.START,
    data: {
      area: null,
      debtBucket: null, // ALTA/MEDIA/BAJA/NS
      licenseType: null, // PARTICULAR/PROFESIONAL
      clientName: null,
      dni: null,
      address: null,
      fineAmount: null,
      fineCount: null,
      fineJuris: null, // CABA/PBA/OTRA
      licenseDue: null, // opcional
      priority: "BAJA",
      priorityReason: [],
      quoteRange: null,
      consent: null,
    },
  };
}

function computeQuoteAndPriority(s) {
  const d = s.data;

  // Prioridad por licencia profesional
  if (d.licenseType === "PROFESIONAL") {
    if (!d.priorityReason.includes("Licencia profesional")) d.priorityReason.push("Licencia profesional");
  }

  // Prioridad por bucket de deuda
  if (d.debtBucket === "ALTA") {
    if (!d.priorityReason.includes("Monto alto")) d.priorityReason.push("Monto alto");
  }

  // Definir PRIORIDAD
  if (d.priorityReason.includes("Licencia profesional") && d.priorityReason.includes("Monto alto")) {
    d.priority = "ALTA";
  } else if (d.priorityReason.length > 0) {
    d.priority = d.priorityReason.includes("Monto alto") || d.priorityReason.includes("Licencia profesional")
      ? "ALTA"
      : "MEDIA";
  } else if (d.debtBucket === "MEDIA") {
    d.priority = "MEDIA";
  } else {
    d.priority = "BAJA";
  }

  // Estimación (editable)
  if (d.debtBucket === "ALTA") d.quoteRange = "$180.000 – $320.000";
  else if (d.debtBucket === "MEDIA") d.quoteRange = "$120.000 – $220.000";
  else d.quoteRange = "$90.000 – $160.000"; // fallback si entrara algo raro
}

function buildOperatorSummary({ wa_id, session }) {
  const d = session.data;
  const motivo = d.priorityReason.length ? d.priorityReason.join(" + ") : "—";

  return [
    "🧾 Lead – Restricción por multas (AMBA)",
    `Prioridad: ${d.priority}`,
    `Motivo prioridad: ${motivo}`,
    "",
    "Cliente",
    `• Nombre: ${d.clientName || "—"}`,
    `• DNI: ${d.dni || "—"}`,
    `• Domicilio legal: ${d.address || "—"}`,
    `• WhatsApp: ${wa_id}`,
    "",
    "Multas / Deuda",
    `• Monto aprox.: ${d.fineAmount || "—"}`,
    `• Cantidad: ${d.fineCount || "—"}`,
    `• Radicación: ${d.fineJuris || "—"}`,
    `• Vencimiento licencia (opcional): ${d.licenseDue || "—"}`,
    "",
    `Estimación honorarios: ${d.quoteRange || "—"}`,
    `Consentimiento: ${d.consent === true ? "✅" : d.consent === false ? "❌" : "—"}`,
  ].join("\n");
}

function nextMessage({ text, wa_id, session }) {
  const t = (text || "").trim();
  const d = session.data;

  const reply = (msg) => ({ action: "REPLY", message: msg });
  const drop = (msg) => ({ action: "DROP", message: msg });

  // START
  if (session.state === STATES.START) {
    session.state = STATES.Q1_AREA;
    return reply(
      "¡Gracias por comunicarte con *Defensa Licencias AMBA*!\n" +
      "Necesitamos hacerte algunas preguntas antes de derivarte con un asesor legal.\n" +
      "Respondé con el número de opción.\n\n" +
      "*1) ¿Dónde estás / dónde necesitás resolverlo?*\n" +
      "1. CABA\n" +
      "2. Conurbano (PBA – AMBA)\n" +
      "3. Interior de PBA (fuera AMBA)\n" +
      "4. Otra provincia"
    );
  }

  // Q1_AREA
  if (session.state === STATES.Q1_AREA) {
    if (!["1", "2", "3", "4"].includes(t)) {
      return reply("Respondé con 1, 2, 3 o 4 para continuar.");
    }
    if (t === "3" || t === "4") {
      session.state = STATES.DROPPED;
      return drop(
        "Gracias. Por el momento trabajamos únicamente *CABA + Conurbano (AMBA)*.\n" +
        "Si tu situación cambia o tenés multas radicadas en AMBA, escribinos y lo revisamos."
      );
    }
    d.area = t === "1" ? "CABA" : "AMBA-PBA";
    session.state = STATES.Q2_DEBT;
    return reply(
      "*2) Sobre las multas/deuda que te impiden renovar:* elegí la opción que más te describa.\n" +
      "1. *Deuda ALTA* (aprox. +$3.000.000) y multas de *CABA o PBA*\n" +
      "2. *Deuda MEDIA* (aprox. $1.500.000 a $3.000.000) y multas de *CABA o PBA*\n" +
      "3. *Deuda BAJA* (menos de $1.500.000)\n" +
      "4. No estoy seguro del monto / necesito estimarlo\n" +
      "5. Las multas son de *otra jurisdicción* (otra provincia/municipio fuera AMBA)"
    );
  }

  // Q2_DEBT
  if (session.state === STATES.Q2_DEBT) {
    if (!["1", "2", "3", "4", "5"].includes(t)) {
      return reply("Respondé con 1, 2, 3, 4 o 5.");
    }
    if (t === "5") {
      session.state = STATES.DROPPED;
      return drop(
        "Gracias. En este momento solo podemos tomar casos con multas radicadas en *CABA o PBA (AMBA)*."
      );
    }
    if (t === "3") {
      session.state = STATES.DROPPED;
      return drop(
        "Gracias. Con deuda *menor a $1.500.000*, en general el costo/beneficio del servicio no lo justifica.\n" +
        "Si el monto sube o tenés licencia profesional, contanos y lo re-evaluamos."
      );
    }
    if (t === "4") {
      d.debtBucket = "NS";
      session.state = STATES.Q2_DEBT_FREE;
      return reply(
        "Perfecto. Para estimarlo rápido:\n" +
        "*¿Podés decirme un monto aproximado y la cantidad de multas?*\n" +
        "Ej.: “$2.200.000 y 8 multas”."
      );
    }

    d.debtBucket = t === "1" ? "ALTA" : "MEDIA";
    session.state = STATES.Q3_LICENSE;
    return reply(
      "*3) ¿Qué tipo de licencia necesitás renovar?*\n" +
      "1. Particular\n" +
      "2. Profesional"
    );
  }

  // Q2_DEBT_FREE (parse libre: “$2.200.000 y 8 multas”)
  if (session.state === STATES.Q2_DEBT_FREE) {
    // Parse simple
    const amountMatch = t.replace(/\./g, "").match(/\$?\s*([0-9]{1,12})/);
    const countMatch = t.match(/(\d+)\s*(multa|multas)/i);

    if (amountMatch) d.fineAmount = `$${Number(amountMatch[1]).toLocaleString("es-AR")}`;
    if (countMatch) d.fineCount = countMatch[1];

    // Bucket por monto si se pudo
    if (amountMatch) {
      const n = Number(amountMatch[1]);
      if (n >= 3000000) d.debtBucket = "ALTA";
      else if (n >= 1500000) d.debtBucket = "MEDIA";
      else d.debtBucket = "BAJA"; // y lo descartamos luego
    }

    if (d.debtBucket === "BAJA") {
      session.state = STATES.DROPPED;
      return drop(
        "Gracias. Con deuda *menor a $1.500.000*, en general el costo/beneficio del servicio no lo justifica.\n" +
        "Si el monto sube o tenés licencia profesional, contanos y lo re-evaluamos."
      );
    }

    session.state = STATES.Q3_LICENSE;
    return reply(
      "*3) ¿Qué tipo de licencia necesitás renovar?*\n" +
      "1. Particular\n" +
      "2. Profesional"
    );
  }

  // Q3_LICENSE
  if (session.state === STATES.Q3_LICENSE) {
    if (!["1", "2"].includes(t)) return reply("Respondé con 1 o 2.");
    d.licenseType = t === "2" ? "PROFESIONAL" : "PARTICULAR";
    session.state = STATES.GET_CLIENT_NAME;
    return reply(
      "Para derivarte con un asesor, pasame estos datos (uno por mensaje):\n" +
      "*Nombre y apellido*"
    );
  }

  // Datos cliente
  if (session.state === STATES.GET_CLIENT_NAME) {
    d.clientName = t;
    session.state = STATES.GET_CLIENT_DNI;
    return reply("*DNI*");
  }
  if (session.state === STATES.GET_CLIENT_DNI) {
    d.dni = t;
    session.state = STATES.GET_CLIENT_ADDRESS;
    return reply("*Domicilio legal* (calle, número, localidad)");
  }
  if (session.state === STATES.GET_CLIENT_ADDRESS) {
    d.address = t;
    session.state = STATES.GET_FINE_AMOUNT;
    return reply("Ahora, sobre las multas:\n*Monto aproximado* (si ya lo sabés)");
  }

  // Datos multas
  if (session.state === STATES.GET_FINE_AMOUNT) {
    d.fineAmount = t;
    session.state = STATES.GET_FINE_COUNT;
    return reply("*Cantidad de multas*");
  }
  if (session.state === STATES.GET_FINE_COUNT) {
    d.fineCount = t;
    session.state = STATES.GET_FINE_JURIS;
    return reply("*Radicación*: ¿son de *CABA* o de *PBA*? (si sabés el municipio, mejor)");
  }
  if (session.state === STATES.GET_FINE_JURIS) {
    const up = t.toUpperCase();
    if (up.includes("CABA")) d.fineJuris = "CABA";
    else if (up.includes("PBA") || up.includes("BUENOS AIRES") || up.includes("PROVINCIA")) d.fineJuris = "PBA";
    else if (up.includes("OTRA") || up.includes("CORDOBA") || up.includes("SANTA FE")) d.fineJuris = "OTRA";
    else d.fineJuris = t;

    // Si detectamos “otra” => descarte por radicación
    if (d.fineJuris === "OTRA") {
      session.state = STATES.DROPPED;
      return drop("Gracias. En este momento solo podemos tomar casos con multas radicadas en *CABA o PBA (AMBA)*.");
    }

    session.state = STATES.GET_FINE_DUE;
    return reply("(Opcional) *Vencimiento de tu licencia* (si querés, poné fecha; si no, escribí “omitir”).");
  }

  if (session.state === STATES.GET_FINE_DUE) {
    if (t.toLowerCase() !== "omitir") d.licenseDue = t;

    // Computar prioridad + honorarios
    computeQuoteAndPriority(session);

    session.state = STATES.QUOTE_AND_CONFIRM;
    return reply(
      "Gracias. Con lo que contás, la *estimación inicial de honorarios* para la evaluación y estrategia del caso sería: " +
      `*${d.quoteRange}*.\n` +
      "(Puede variar según documentación, radicación y complejidad).\n\n" +
      "*¿Querés que te contacte un asesor legal dentro del horario de atención?*\n" +
      "1. Sí, continuar\n" +
      "2. No por ahora"
    );
  }

  // Confirmación
  if (session.state === STATES.QUOTE_AND_CONFIRM) {
    if (!["1", "2"].includes(t)) return reply("Respondé con 1 o 2.");
    if (t === "2") {
      session.state = STATES.DONE;
      return reply("Perfecto. Cuando quieras retomar, escribinos y continuamos.");
    }
    session.state = STATES.CONSENT;
    return reply(
      "Antes de derivarte:\n" +
      "*Consentimiento*: al continuar, aceptás que usemos los datos que enviaste *solo* para evaluar tu consulta, " +
      "contactarte por WhatsApp y preparar la intervención legal. No compartimos tu información con terceros ajenos al caso. " +
      "Podés pedir actualización o eliminación de tus datos en cualquier momento.\n\n" +
      "*¿Aceptás?*\n" +
      "1. Acepto\n" +
      "2. No acepto"
    );
  }

  // Consent
  if (session.state === STATES.CONSENT) {
    if (!["1", "2"].includes(t)) return reply("Respondé con 1 o 2.");
    d.consent = t === "1";

    if (!d.consent) {
      session.state = STATES.DONE;
      return reply(
        "Perfecto. Sin ese consentimiento no podemos avanzar con la evaluación por este medio.\n" +
        "Si querés, podés volver a escribir cuando estés listo/a para continuar."
      );
    }

    session.state = STATES.DONE;
    return {
      action: "HANDOFF",
      message:
        "Listo. Quedó registrada tu información.\n" +
        "Un asesor legal te va a contactar *dentro del horario de atención*.",
      operatorSummary: buildOperatorSummary({ wa_id, session }),
    };
  }

  // Default
  return reply("Escribí “hola” para iniciar el flujo.");
}

export { STATES, initialSession, nextMessage };
