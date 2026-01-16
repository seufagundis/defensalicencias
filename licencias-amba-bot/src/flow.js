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

const IDS = {
  AREA_CABA: "AREA_CABA",
  AREA_AMBA: "AREA_AMBA",
  AREA_PBA_INT: "AREA_PBA_INT",
  AREA_OTRA: "AREA_OTRA",
  DEBT_ALTA: "DEBT_ALTA",
  DEBT_MEDIA: "DEBT_MEDIA",
  DEBT_BAJA: "DEBT_BAJA",
  DEBT_NS: "DEBT_NS",
  DEBT_OTRAJUR: "DEBT_OTRAJUR",
  LIC_PART: "LIC_PART",
  LIC_PRO: "LIC_PRO",
  CONFIRM_YES: "CONFIRM_YES",
CONFIRM_NO: "CONFIRM_NO",
CONSENT_YES: "CONSENT_YES",
CONSENT_NO: "CONSENT_NO",


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

function normalizeText(input) {
  return String(input || "")
    .trim()
    .toUpperCase();
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

  function replyList(body, buttonText, sections) {
    return { action: "REPLY_LIST", body, buttonText, sections };
  }

  function replyButtons(body, buttons) {
    return { action: "REPLY_BUTTONS", body, buttons };
  }


  const reply = (msg) => ({ action: "REPLY_TEXT", message: msg });
  const drop = (msg) => ({ action: "DROP", message: msg });

  // START
  if (session.state === STATES.START) {
    session.state = STATES.Q1_AREA;
    return replyList(
      "¡Gracias por comunicarte con *Defensa Licencias AMBA*!\nNecesito 3 preguntas para derivarte con un asesor.\n\n*1) ¿Dónde lo necesitás resolver?*",
      "Elegir",
      [{
        title: "Zona",
        rows: [
          { id: IDS.AREA_CABA, title: "CABA", description: "Ciudad Autónoma de Buenos Aires" },
          { id: IDS.AREA_AMBA, title: "Conurbano (AMBA)", description: "GBA / Provincia en AMBA" },
          { id: IDS.AREA_PBA_INT, title: "Interior PBA", description: "Fuera AMBA" },
          { id: IDS.AREA_OTRA, title: "Otra provincia", description: "Fuera Buenos Aires" }
        ]
      }]
    );

  }

  // Q1_AREA
  if (session.state === STATES.Q1_AREA) {
    const t = normalizeText(text);

    if (![IDS.AREA_CABA, IDS.AREA_AMBA, IDS.AREA_PBA_INT, IDS.AREA_OTRA].includes(t)) {
      return reply("Elegí una opción usando el menú para continuar.");
    }

    if (t === IDS.AREA_PBA_INT || t === IDS.AREA_OTRA) {
      return { action: "DROP", message: "Gracias. Por el momento solo tomamos casos en *AMBA (CABA + Conurbano)*." };
    }

    session.data.area = (t === IDS.AREA_CABA) ? "CABA" : "AMBA";
    session.state = STATES.Q2_DEBT;


    return replyList(
      "*2) ¿De cuánto es la deuda aproximada?*",
      "Elegir",
      [{
        title: "Monto aproximado",
        rows: [
          { id: IDS.DEBT_ALTA, title: "Más de $3.000.000", description: "Deuda alta / muchas actas" },
          { id: IDS.DEBT_MEDIA, title: "Entre $500.000 y $3.000.000", description: "Deuda media" },
          { id: IDS.DEBT_BAJA, title: "Menos de $500.000", description: "Deuda baja" },
          { id: IDS.DEBT_NS, title: "No sé el monto", description: "Necesito que lo revisen" },
          { id: IDS.DEBT_OTRAJUR, title: "Cruce de jurisdicción", description: "CABA/PBA cruzadas u otras" },
        ]
      }]
    );

  }

  // Q2_DEBT
  if (session.state === STATES.Q2_DEBT) {
    const t = normalizeText(text);

    const allowed = [IDS.DEBT_ALTA, IDS.DEBT_MEDIA, IDS.DEBT_BAJA, IDS.DEBT_NS, IDS.DEBT_OTRAJUR];
    if (!allowed.includes(t)) {
      return reply("Elegí una opción usando el menú para continuar.");
    }

  d.debtBucket =
  t === IDS.DEBT_ALTA ? "ALTA" :
  t === IDS.DEBT_MEDIA ? "MEDIA" :
  t === IDS.DEBT_BAJA ? "BAJA" :
  t === IDS.DEBT_OTRAJUR ? "OTRA_JURIS" :
  "NO_SABE";

    session.state = STATES.Q3_LICENSE;

    return replyButtons(
      "*3) ¿Qué tipo de licencia tenés?*",
      [
        { id: "LIC_PART", title: "Particular" },
        { id: "LIC_PRO", title: "Profesional" },
      ]
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
return replyButtons(
  "*3) ¿Qué tipo de licencia tenés?*",
  [
    { id: IDS.LIC_PART, title: "Particular" },
    { id: IDS.LIC_PRO, title: "Profesional" },
  ]
);

  }

  // Q3_LICENSE
 if (session.state === STATES.Q3_LICENSE) {
  const t = normalizeText(text);

  if (![IDS.LIC_PART, IDS.LIC_PRO].includes(t)) {
    return reply("Tocá un botón para continuar.");
  }

  session.data.licenseType = (t === IDS.LIC_PRO) ? "PROFESIONAL" : "PARTICULAR";
  session.state = STATES.GET_CLIENT_NAME;
return reply("Perfecto. Ahora sí: *tu nombre y apellido*:");

}


  // Datos cliente
// Datos cliente
if (session.state === STATES.GET_CLIENT_NAME) {
  const name = String(text || "").trim();
  if (name.length < 3) return reply("Decime tu *nombre y apellido* (mínimo 3 caracteres).");
  d.clientName = name;
  session.state = STATES.GET_CLIENT_DNI;
  return reply("Gracias. Ahora tu *DNI* (solo números):");
}

if (session.state === STATES.GET_CLIENT_DNI) {
  const dni = String(text || "").replace(/\D/g, "");
  if (dni.length < 6) return reply("DNI inválido. Enviá tu *DNI* (solo números).");
  d.dni = dni;
  session.state = STATES.GET_CLIENT_ADDRESS;
  return reply("Perfecto. *Domicilio legal* (calle y altura):");
}

if (session.state === STATES.GET_CLIENT_ADDRESS) {
  const addr = String(text || "").trim();
  if (addr.length < 5) return reply("Domicilio muy corto. Enviá *calle y altura*.");
  d.address = addr;
  session.state = STATES.GET_FINE_AMOUNT;
  return reply("Monto aproximado de la deuda (si no sabés, poné *NO SÉ*):");
}

// Datos multas
if (session.state === STATES.GET_FINE_AMOUNT) {
  const raw = String(text || "").trim();
  d.fineAmount = raw.toUpperCase().includes("NO") ? null : raw;
  session.state = STATES.GET_FINE_COUNT;
  return reply("Cantidad aproximada de multas/actas (si no sabés, poné *NO SÉ*):");
}

if (session.state === STATES.GET_FINE_COUNT) {
  const raw = String(text || "").trim();
  d.fineCount = raw.toUpperCase().includes("NO") ? null : raw;
  session.state = STATES.GET_FINE_JURIS;
  return reply("¿Dónde están radicadas principalmente? (CABA / PBA / Mixto / No sé):");
}

if (session.state === STATES.GET_FINE_JURIS) {
  d.fineJuris = String(text || "").trim();
  session.state = STATES.GET_FINE_DUE;
  return reply("Vencimiento de la licencia (opcional). Si no aplica, poné *NO*:");
}

if (session.state === STATES.GET_FINE_DUE) {
  const exp = String(text || "").trim();
  d.licenseDue = exp;

  // ✅ antes de confirmar, calculamos prioridad + rango
  computeQuoteAndPriority(session);

  session.state = STATES.QUOTE_AND_CONFIRM;

  const summary =
    `• Nombre: ${d.clientName}\n` +
    `• DNI: ${d.dni}\n` +
    `• Domicilio: ${d.address}\n` +
    `• Área: ${d.area}\n` +
    `• Deuda: ${d.debtBucket || "—"}\n` +
    `• Tipo licencia: ${d.licenseType}\n` +
    `• Monto: ${d.fineAmount ?? "NO SÉ"}\n` +
    `• Cantidad: ${d.fineCount ?? "NO SÉ"}\n` +
    `• Radicación: ${d.fineJuris}\n` +
    `• Vencimiento: ${d.licenseDue}\n` +
    `• Estimación: ${d.quoteRange}\n`;

  return replyButtons(
    `Revisá si está bien:\n\n${summary}\n\n¿Confirmás?`,
    [
      { id: IDS.CONFIRM_YES, title: "Confirmo" },
      { id: IDS.CONFIRM_NO, title: "Corregir" },
    ]
  );
}


  // Confirmación
 if (session.state === STATES.QUOTE_AND_CONFIRM) {
  const x = normalizeText(text);

  if (x === IDS.CONFIRM_NO) {
    session.state = STATES.GET_CLIENT_NAME;
    return reply("Ok. Corregimos desde el inicio. *Nombre y apellido*:");
  }

  if (x !== IDS.CONFIRM_YES) {
    return reply("Tocá un botón para continuar.");
  }

  session.state = STATES.CONSENT;
  return replyButtons(
    "Antes de derivarte:\n¿Aceptás que usemos tus datos solo para evaluar tu caso y contactarte por WhatsApp?",
    [
      { id: IDS.CONSENT_YES, title: "Acepto" },
      { id: IDS.CONSENT_NO, title: "No acepto" },
    ]
  );
}


  // Consent
 if (session.state === STATES.CONSENT) {
  const x = normalizeText(text);

  if (x === IDS.CONSENT_NO) {
    d.consent = false;
    session.state = STATES.DONE;
    return reply(
      "Perfecto. Sin ese consentimiento no podemos avanzar con la evaluación por este medio.\n" +
      "Si querés, podés volver a escribir cuando estés listo/a para continuar."
    );
  }

  if (x !== IDS.CONSENT_YES) {
    return reply("Tocá un botón para continuar.");
  }

  d.consent = true;
  session.state = STATES.DONE;

  return {
    action: "HANDOFF",
    message:
      "Listo ✅ Quedó registrada tu información.\n" +
      "Un asesor legal te va a contactar *dentro del horario de atención*.",
    operatorSummary: buildOperatorSummary({ wa_id, session }),
  };
}


  // Default
  return reply("Escribí “hola” para iniciar el flujo.");
}

export { STATES, initialSession, nextMessage };
