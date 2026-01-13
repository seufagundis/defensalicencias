export function parseIncomingMessage(body) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  const message = value?.messages?.[0];
  if (!message) return null;

  const wa_id = value?.contacts?.[0]?.wa_id || message.from;
  const text = message?.text?.body ?? null;

  return {
    wa_id,
    text,
    raw: message
  };
}
