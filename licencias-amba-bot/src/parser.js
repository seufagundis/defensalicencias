export function parseIncomingMessage(body) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  const message = value?.messages?.[0];
  if (!message) return null;

  // ✅ CLAVE: usar siempre el remitente real del mensaje
  const wa_id = message.from;

  let text = message?.text?.body ?? null;

  if (message?.type === "interactive") {
    const i = message.interactive;
    const btnId = i?.button_reply?.id;
    const listId = i?.list_reply?.id;
    text = btnId || listId || text;
  }

  return { wa_id, text, raw: message };
}
