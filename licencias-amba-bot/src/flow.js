// src/flow.js

const STATES = {
  START: "START",
  Q1_AREA: "Q1_AREA",
  Q1_MUNICIPALITY: "Q1_MUNICIPALITY",
  Q2_DEBT: "Q2_DEBT",
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
  AREA_PBA: "AREA_PBA",
  AREA_CABA: "AREA_CABA",
  AREA_OTRA: "AREA_OTRA",

  DEBT_ALTA: "DEBT_ALTA",
  DEBT_MEDIA: "DEBT_MEDIA",
  DEBT_BAJA: "DEBT_BAJA",

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
      municipality: null,
      debtBucket: null, // ALTA / MEDIA / BAJA
      clientName: null,
      dni: null,
      address: null,
      fineAmount: null,
      fineCount: null,
      fineJuris: null,
      licenseDue: null,
      priority: "BAJA",
      priorityReason: [],
      quoteRange: null,
      consent: null,
    },
  };
}

function normalizeText(input) {
  return String(input || "").trim().toUpperCase();
}

function computeQuoteAndPriority(session) {
  const d = session.data;

  d.priorityReason = [];

  if (d.debtBucket === "ALTA") {
    d.priority = "ALTA";
    d.priorityReason.push("Monto alto");
    d.quoteRange = "$180.000 – $320.000";
  } else if (d.debtBucket === "MEDIA") {
    d.priority = "MEDIA";
    d.quoteRange = "$120.000 – $220.000";
  } else {
    d.priority = "BAJA";
    d.quoteRange = "$90.000 – $160.000";
  }
}

function buildOperatorSummary({ wa_id, session }) {
  const d = session.data;
  const motivo = d.priorityReason.length ? d.priorityReason.join(" + ") : "—";

  return [
    "🧾 Lead – Restricción por multas (PBA)",
    `Prioridad: ${d.priority}`,
    `Motivo prioridad: ${motivo}`,
    "",
    "Cliente",
    `• Nombre: ${d.clientName || "—"}`,
    `• DNI: ${d.dni || "—"}`,
    `• Domicilio: ${d.address || "—"}`,
    `• WhatsApp: ${wa_id}`,
    "",
    "Caso",
    `• Área: ${d.area || "—"}`,
    `• Municipio / localidad: ${d.municipality || "—"}`,
    `• Bucket de deuda: ${d.debtBucket || "—"}`,
    "",
    "Multas / Deuda",
    `• Monto aprox.: ${d.fineAmount || "—"}`,
    `• Cantidad: ${d.fineCount || "—"}`,
    `• Radicación: ${d.fineJuris || "—"}`,
    `• Vencimiento licencia: ${d.licenseDue || "—"}`,
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
      "¡Gracias por comunicarte con *Defensa Licencias*!\n\nEste canal permite realizar una evaluación inicial de tu caso. La información que brindes será revisada de manera individual por un asesor.\n\nEste contacto no constituye asesoramiento definitivo ni genera costos.\n\nPara continuar, necesito hacerte unas preguntas breves.\n\n*1) ¿Dónde necesitás resolverlo?*",
      "Elegir",
      [
        {
          title: "Ubicación",
          rows: [
            { id: IDS.AREA_PBA, title: "Pcia de Buenos Aires", description: "PBA" },
            { id: IDS.AREA_CABA, title: "C. Autónoma de Buenos Aires", description: "CABA" },
            { id: IDS.AREA_OTRA, title: "Otra provincia", description: "Interior del país" },
          ],
        },
      ]
    );
  }

  // Q1_AREA
  if (session.state === STATES.Q1_AREA) {
    const x = normalizeText(text);

    if (![IDS.AREA_PBA, IDS.AREA_CABA, IDS.AREA_OTRA].includes(x)) {
      return reply("Elegí una opción usando el menú para continuar.");
    }

    if (x === IDS.AREA_CABA || x === IDS.AREA_OTRA) {
      session.state = STATES.DROPPED;
      return drop("Gracias por escribirnos. Por el momento, solo estamos tomando casos de *Provincia de Buenos Aires*.");
    }

    d.area = "PBA";
    session.state = STATES.Q1_MUNICIPALITY;
    return reply("Perfecto. Indicame tu *localidad o municipio*:");
  }

  // Q1_MUNICIPALITY
  if (session.state === STATES.Q1_MUNICIPALITY) {
    const municipality = String(text || "").trim();

    if (municipality.length < 3) {
      return reply("Por favor, indicá tu *localidad o municipio*.");
    }

    d.municipality = municipality;
    session.state = STATES.Q2_DEBT;

    return replyList(
      "*2) ¿De cuánto es la deuda aproximada?*",
      "Elegir",
      [
        {
          title: "Monto aproximado",
          rows: [
            { id: IDS.DEBT_ALTA, title: "Más de $3.000.000", description: "Deuda alta / muchas actas" },
            { id: IDS.DEBT_MEDIA, title: "$1.000.000/$3.000.000", description: "Deuda media" },
            { id: IDS.DEBT_BAJA, title: "Menos de $1.000.000", description: "Deuda baja" },
          ],
        },
      ]
    );
  }

  // Q2_DEBT
  if (session.state === STATES.Q2_DEBT) {
    const x = normalizeText(text);

    if (![IDS.DEBT_ALTA, IDS.DEBT_MEDIA, IDS.DEBT_BAJA].includes(x)) {
      return reply("Elegí una opción usando el menú para continuar.");
    }

    d.debtBucket =
      x === IDS.DEBT_ALTA
        ? "ALTA"
        : x === IDS.DEBT_MEDIA
        ? "MEDIA"
        : "BAJA";

    if (x === IDS.DEBT_BAJA) {
      session.state = STATES.DROPPED;
      return drop(
        "Gracias. En casos con deuda *menor a $1.000.000*, en general el costo del servicio jurídico no suele justificar el inicio de la gestión.\n\nSi la situación cambia, o si existen otras particularidades relevantes, podés volver a escribirnos."
      );
    }

    session.state = STATES.GET_CLIENT_NAME;
    return reply("Perfecto. Ahora sí: indicame tu *nombre y apellido*:");
  }

  // GET_CLIENT_NAME
  if (session.state === STATES.GET_CLIENT_NAME) {
    const name = String(text || "").trim();

    if (name.length < 3) {
      return reply("Decime tu *nombre y apellido* (mínimo 3 caracteres).");
    }

    d.clientName = name;
    session.state = STATES.GET_CLIENT_DNI;
    return reply("Gracias. Ahora tu *DNI* (solo números):");
  }

  // GET_CLIENT_DNI
  if (session.state === STATES.GET_CLIENT_DNI) {
    const dni = String(text || "").replace(/\D/g, "");

    if (dni.length < 6) {
      return reply("DNI inválido. Enviá tu *DNI* (solo números).");
    }

    d.dni = dni;
    session.state = STATES.GET_CLIENT_ADDRESS;
    return reply("Perfecto. Indicá tu *domicilio* (calle y altura):");
  }

  // GET_CLIENT_ADDRESS
  if (session.state === STATES.GET_CLIENT_ADDRESS) {
    const addr = String(text || "").trim();

    if (addr.length < 5) {
      return reply("Domicilio muy corto. Enviá *calle y altura*.");
    }

    d.address = addr;
    session.state = STATES.GET_FINE_AMOUNT;
    return reply("Indicá el *monto aproximado* de la deuda total (si no lo sabés, respondé *NO SÉ*):");
  }

  // GET_FINE_AMOUNT
  if (session.state === STATES.GET_FINE_AMOUNT) {
    const raw = String(text || "").trim();
    d.fineAmount = raw.toUpperCase().includes("NO") ? null : raw;
    session.state = STATES.GET_FINE_COUNT;
    return reply("Indicá la *cantidad aproximada de multas o actas* (si no lo sabés, respondé *NO SÉ*):");
  }

  // GET_FINE_COUNT
  if (session.state === STATES.GET_FINE_COUNT) {
    const raw = String(text || "").trim();
    d.fineCount = raw.toUpperCase().includes("NO") ? null : raw;
    session.state = STATES.GET_FINE_JURIS;
    return reply("¿Dónde están radicadas principalmente? (*PBA / CABA / Mixto / No sé*):");
  }

  // GET_FINE_JURIS
  if (session.state === STATES.GET_FINE_JURIS) {
    d.fineJuris = String(text || "").trim();
    session.state = STATES.GET_FINE_DUE;
    return reply("Indicá el *vencimiento de la licencia* (opcional). Si no aplica o no lo sabés, respondé *NO*:");
  }

  // GET_FINE_DUE
  if (session.state === STATES.GET_FINE_DUE) {
    d.licenseDue = String(text || "").trim();

    computeQuoteAndPriority(session);
    session.state = STATES.QUOTE_AND_CONFIRM;

    const summary =
      `• Nombre: ${d.clientName}\n` +
      `• DNI: ${d.dni}\n` +
      `• Domicilio: ${d.address}\n` +
      `• Área: ${d.area}\n` +
      `• Municipio / localidad: ${d.municipality}\n` +
      `• Deuda: ${d.debtBucket || "—"}\n` +
      `• Monto: ${d.fineAmount ?? "NO SÉ"}\n` +
      `• Cantidad: ${d.fineCount ?? "NO SÉ"}\n` +
      `• Radicación: ${d.fineJuris}\n` +
      `• Vencimiento: ${d.licenseDue}\n` +
      `• Estimación: ${d.quoteRange}\n`;

    return replyButtons(
      `Revisá si está bien:\n\n${summary}\n¿Confirmás?`,
      [
        { id: IDS.CONFIRM_YES, title: "Confirmo" },
        { id: IDS.CONFIRM_NO, title: "Corregir" },
      ]
    );
  }

  // QUOTE_AND_CONFIRM
  if (session.state === STATES.QUOTE_AND_CONFIRM) {
    const x = normalizeText(text);

    if (x === IDS.CONFIRM_NO) {
      session.state = STATES.GET_CLIENT_NAME;
      return reply("Ok. Corregimos desde el inicio de los datos personales. Indicame nuevamente tu *nombre y apellido*:");
    }

    if (x !== IDS.CONFIRM_YES) {
      return reply("Tocá un botón para continuar.");
    }

    session.state = STATES.CONSENT;

    return replyButtons(
      "Antes de derivarte:\n¿Aceptás que utilicemos tus datos exclusivamente para evaluar tu caso y contactarte por WhatsApp?",
      [
        { id: IDS.CONSENT_YES, title: "Acepto" },
        { id: IDS.CONSENT_NO, title: "No acepto" },
      ]
    );
  }

  // CONSENT
  if (session.state === STATES.CONSENT) {
    const x = normalizeText(text);

    if (x === IDS.CONSENT_NO) {
      d.consent = false;
      session.state = STATES.DONE;
      return reply(
        "Perfecto. Sin ese consentimiento no podemos avanzar con la evaluación por este medio.\nSi querés, podés volver a escribir cuando estés listo/a para continuar."
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
        "Listo ✅ Tu información quedó registrada.\n" +
        "Un asesor se va a comunicar con vos *dentro del horario de atención*.",
      operatorSummary: buildOperatorSummary({ wa_id, session }),
    };
  }

  return reply('Escribí "hola" para iniciar el flujo.');
}

export { STATES, initialSession, nextMessage };