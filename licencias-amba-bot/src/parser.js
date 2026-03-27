export function parseIncomingMessage(body) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  const message = value?.messages?.[0];
  if (!message) return null;

  const wa_id = message.from;
  const messageId = message.id;

  let text = message?.text?.body?.trim() ?? null;

  if (message?.type === "interactive") {
    const i = message.interactive;
    const btnId = i?.button_reply?.id;
    const listId = i?.list_reply?.id;
    text = btnId || listId || text;
  }

  if (!wa_id || !text) return null;

  return {
    wa_id,
    text,
    messageId,
    raw: message,
  };
}