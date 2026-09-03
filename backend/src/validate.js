// src/validate.js
//
// Article 5: never trust client-side validation alone. Every request body
// is validated and size-bounded server-side before it touches Gemini or
// Firestore.

const MAX_MESSAGE_CHARS = 4000;
const MAX_MESSAGES_PER_CONVERSATION = 60;

export function validateConversationPayload(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  const { message, history } = body;

  if (typeof message !== 'string' || message.trim().length === 0) {
    return { ok: false, error: '"message" must be a non-empty string.' };
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return { ok: false, error: `"message" exceeds ${MAX_MESSAGE_CHARS} characters.` };
  }

  if (history !== undefined) {
    if (!Array.isArray(history)) {
      return { ok: false, error: '"history" must be an array.' };
    }
    if (history.length > MAX_MESSAGES_PER_CONVERSATION) {
      return { ok: false, error: 'Conversation is too long for this session.' };
    }
    for (const m of history) {
      if (
        !m ||
        typeof m.text !== 'string' ||
        m.text.length > MAX_MESSAGE_CHARS ||
        !['user', 'assistant'].includes(m.role)
      ) {
        return { ok: false, error: 'Malformed message in "history".' };
      }
    }
  }

  return { ok: true };
}

export function validateSavePayload(body) {
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, error: '"messages" must be a non-empty array.' };
  }
  if (body.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
    return { ok: false, error: 'Conversation is too long to save.' };
  }
  for (const m of body.messages) {
    if (
      !m ||
      typeof m.text !== 'string' ||
      m.text.length > MAX_MESSAGE_CHARS ||
      !['user', 'assistant'].includes(m.role)
    ) {
      return { ok: false, error: 'Malformed message in "messages".' };
    }
  }
  return { ok: true };
}
