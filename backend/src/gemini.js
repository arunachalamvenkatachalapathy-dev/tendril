// src/gemini.js
//
// All Gemini calls happen server-side only. The API key is fetched from
// Secret Manager (see secretManager.js) and never touches the client.

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getGeminiApiKey } from './secretManager.js';

const CHAT_MODEL = 'gemini-2.0-flash';

let cachedClient = null;
let cachedClientKey = null;

async function getClient() {
  const key = await getGeminiApiKey();
  if (!cachedClient || cachedClientKey !== key) {
    cachedClient = new GoogleGenerativeAI(key);
    cachedClientKey = key;
  }
  return cachedClient;
}

const JOURNAL_SYSTEM_PROMPT = `You are a warm, non-judgmental journaling and
brainstorming companion inside a personal journal app. The person writing to
you may be venting, reflecting, or brainstorming ideas. Respond
conversationally, ask at most one gentle follow-up question when it helps
them go deeper, and never lecture. Keep replies concise (2-5 sentences)
unless the user is clearly asking for a longer brainstorm. You are not a
therapist and do not diagnose; if someone describes a crisis or intent to
harm themselves, gently encourage them to reach out to a crisis line or
someone they trust, in addition to responding supportively.`;

/**
 * Multi-turn chat. `history` is an array of { role: 'user'|'model', text }.
 * `memoryPreamble`, if provided (see memory/pipeline.js buildSystemPreamble),
 * is appended to the system instruction so the model has continuity with
 * the user's own past entries. Returns the model's reply text.
 */
export async function chatReply(history, newUserMessage, memoryPreamble = '') {
  const client = await getClient();
  const systemInstruction = memoryPreamble
    ? `${JOURNAL_SYSTEM_PROMPT}\n\n${memoryPreamble}`
    : JOURNAL_SYSTEM_PROMPT;

  const model = client.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction,
  });

  const chat = model.startChat({
    history: history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
  });

  const result = await chat.sendMessage(newUserMessage);
  return result.response.text();
}

const SUMMARY_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: {
      type: SchemaType.STRING,
      description: 'A short 3-6 word title capturing the essence of this entry.',
    },
    summary: {
      type: SchemaType.STRING,
      description: '2-4 sentence third-person summary of what was discussed or reflected on.',
    },
    mood: {
      type: SchemaType.STRING,
      description: 'Single best-fit mood word for the overall entry.',
      enum: ['calm', 'happy', 'excited', 'hopeful', 'neutral', 'stressed', 'frustrated', 'sad', 'anxious'],
    },
    themes: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: '1 to 3 short lowercase keyword themes, e.g. "work", "family", "career change".',
    },
  },
  required: ['title', 'summary', 'mood', 'themes'],
};

/**
 * Produces a structured { title, summary, mood, themes } for a finished
 * conversation, used both for the saved entry and the Phase-3 mood-trend
 * feature. Uses response_mime_type + response_schema so the output is
 * guaranteed-parseable JSON rather than free text we'd have to regex.
 */
export async function summarizeConversation(messages) {
  const client = await getClient();
  const model = client.getGenerativeModel({
    model: CHAT_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SUMMARY_SCHEMA,
    },
  });

  const transcript = messages
    .map((m) => `${m.role === 'assistant' ? 'Journal companion' : 'User'}: ${m.text}`)
    .join('\n');

  const prompt = `Here is a journaling/brainstorming conversation. Summarize
it and classify its mood and themes per the response schema.\n\n${transcript}`;

  const result = await model.generateContent(prompt);
  const json = JSON.parse(result.response.text());
  return json;
}

/**
 * Generic plain-text generation, used by the memory compaction pipeline
 * (src/memory/*) for daily/recent/archive summarization prompts.
 */
export async function generateText(prompt) {
  const client = await getClient();
  const model = client.getGenerativeModel({ model: CHAT_MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

/**
 * Generic JSON-object generation (e.g. dashboard recommendations). Returns
 * null on any parse/generation failure — callers must treat the
 * recommendation feature as optional and never let it break the dashboard.
 */
export async function generateJsonObject(prompt) {
  const client = await getClient();
  const model = client.getGenerativeModel({
    model: CHAT_MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });
  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (err) {
    console.error('[gemini.generateJsonObject] failed:', err.message);
    return null;
  }
}

/**
 * JSON-array generation for idea extraction (src/memory/pipeline.js).
 * Falls back to an empty array if the model doesn't return valid JSON —
 * idea extraction is a nice-to-have layer and must never throw and block
 * the entry-save flow it's attached to.
 */
export async function generateJsonArray(prompt) {
  const client = await getClient();
  const model = client.getGenerativeModel({
    model: CHAT_MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });
  try {
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[gemini.generateJsonArray] failed:', err.message);
    return [];
  }
}
