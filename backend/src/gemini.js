// src/gemini.js
//
// All Gemini calls happen server-side only. The API key is fetched from
// Secret Manager (see secretManager.js) and never touches the client.

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getGeminiApiKey } from './secretManager.js';

// Tested and verified model cascades (March 2026 / Gemini 3 generation)
const CHAT_MODELS_CASCADE = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemma-4-26b-a4b-it',
];

const SUMMARY_MODELS_CASCADE = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

const JSON_MODELS_CASCADE = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
];

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

/**
 * Executes an async operation with exponential backoff for transient 429 (rate limit)
 * or 503 (high demand) status codes.
 */
async function withRetry(fn, maxRetries = 2, baseDelay = 1000) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (err) {
      const msg = err.message || '';
      const status = err.status || (msg.includes('429') ? 429 : msg.includes('503') ? 503 : 0);
      const isTransient = status === 429 || status === 503;

      if (!isTransient || attempt === maxRetries) {
        throw err;
      }

      attempt += 1;
      const jitter = Math.random() * 400;
      const delay = baseDelay * Math.pow(2, attempt - 1) + jitter;
      console.warn(`[gemini.withRetry] Transient error ${status}, retrying attempt ${attempt}/${maxRetries} in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

const JOURNAL_SYSTEM_PROMPT = `You are Tendril, a warm, non-judgmental, deeply intuitive journaling and brainstorming companion.
The person writing to you may be venting, reflecting, exploring challenges, or brainstorming ideas.
Respond conversationally, always acknowledge their feelings with genuine presence, and conclude your response by asking one gentle, intuitive, open-ended question to help them reflect deeper.
Keep replies concise (2 to 4 sentences). Never lecture, judge, or produce dry robotic lists. You are not a therapist and do not diagnose. If someone describes a crisis or self-harm, warmly encourage them to reach out to someone they trust or a crisis resource.`;

/**
 * Multi-turn chat with resilient multi-tier fallback across Gemini models.
 * If any model encounters 503, 429, or capacity exhaustion, it seamlessly cascades
 * to the next model without breaking user conversations.
 */
export async function chatReply(history, newUserMessage, memoryPreamble = '', image = null, language = 'en') {
  const client = await getClient();

  const langInstruction = language === 'multi'
    ? '\n\nLANGUAGE INSTRUCTION: Multilingual mode is enabled. Detect the user\'s language (English, Spanish, French, Hindi, Tamil, German, Japanese, etc.) and respond fluently, warmly, and naturally in that exact same language.'
    : '\n\nLANGUAGE INSTRUCTION: You must strictly converse and respond in fluent, natural English at all times, regardless of background noise.';

  const systemInstruction = memoryPreamble
    ? `${JOURNAL_SYSTEM_PROMPT}\n\n${memoryPreamble}${langInstruction}`
    : `${JOURNAL_SYSTEM_PROMPT}${langInstruction}`;

  let lastError = null;

  for (const modelName of CHAT_MODELS_CASCADE) {
    // If an image is attached, skip text-only models like gemma
    if (image && modelName.startsWith('gemma')) {
      continue;
    }

    try {
      const reply = await withRetry(async () => {
        const model = client.getGenerativeModel({
          model: modelName,
          systemInstruction: modelName.startsWith('gemma') ? undefined : systemInstruction,
        });

        const parts = [];
        if (image && image.data) {
          parts.push({
            inlineData: {
              mimeType: image.mimeType || 'image/jpeg',
              data: image.data,
            },
          });
        }
        parts.push({ text: newUserMessage || 'What do you observe in this image?' });

        // If previous history exists and model supports chat
        if (history && history.length > 0) {
          const chat = model.startChat({
            history: history.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.text }],
            })),
          });
          const result = await chat.sendMessage(parts);
          return result.response.text();
        } else {
          const result = await model.generateContent(parts);
          return result.response.text();
        }
      }, 1, 800);

      if (reply && reply.trim()) {
        return reply.trim();
      }
    } catch (err) {
      console.warn(`[gemini.chatReply] Model ${modelName} failed (${err.message}), falling back...`);
      lastError = err;
    }
  }

  // Graceful fallback response so the user's conversation is never broken
  console.error('[gemini.chatReply] All cascade models failed, returning graceful fallback:', lastError?.message);
  return "I hear what you're saying and I'm right here with you. What feels most important to focus on as you sit with this thought?";
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
    cognitiveReframing: {
      type: SchemaType.STRING,
      description: 'If the user expressed self-doubt, catastrophizing, impostor syndrome, or overwhelm, provide a gentle 1-2 sentence empowering cognitive reframing (CBT perspective shift). Otherwise empty string.',
    },
    actionItems: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: '1 to 3 concrete micro-actionable next steps or habit sparks distilled from the conversation.',
    },
  },
  required: ['title', 'summary', 'mood', 'themes', 'cognitiveReframing', 'actionItems'],
};

/**
 * Produces structured { title, summary, mood, themes, cognitiveReframing, actionItems }
 * with resilient fallback across Gemini models.
 */
export async function summarizeConversation(messages) {
  const client = await getClient();
  const transcript = messages
    .map((m) => `${m.role === 'assistant' ? 'Journal companion' : 'User'}: ${m.text}`)
    .join('\n');

  const prompt = `Here is a journaling/brainstorming conversation. Summarize
it, classify mood and themes, provide a gentle cognitive reframing if distress or overthinking is present, and extract micro-actions per schema.\n\n${transcript}`;

  let lastError = null;
  for (const modelName of SUMMARY_MODELS_CASCADE) {
    try {
      const summary = await withRetry(async () => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: SUMMARY_SCHEMA,
          },
        });
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
      }, 1, 800);

      if (summary && summary.title) {
        return summary;
      }
    } catch (err) {
      console.warn(`[gemini.summarizeConversation] Model ${modelName} failed (${err.message}), trying next in cascade...`);
      lastError = err;
    }
  }

  // Graceful fallback if structured generation fails
  return {
    title: 'Journal Session',
    summary: messages.slice(0, 2).map((m) => m.text).join(' ').slice(0, 150) + '...',
    mood: 'calm',
    themes: ['reflection', 'journal'],
    cognitiveReframing: 'Every reflection is a step forward toward deeper clarity.',
    actionItems: ['Review your key takeaways tomorrow'],
  };
}

/**
 * Generic plain-text generation with resilient model cascade.
 */
export async function generateText(prompt) {
  const client = await getClient();
  let lastError = null;

  for (const modelName of CHAT_MODELS_CASCADE) {
    try {
      const res = await withRetry(async () => {
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      }, 1, 800);
      if (res) return res;
    } catch (err) {
      console.warn(`[gemini.generateText] ${modelName} failed (${err.message}), falling back...`);
      lastError = err;
    }
  }

  throw lastError || new Error('generateText cascade failed');
}

/**
 * Generic JSON-object generation with cascade fallback.
 */
export async function generateJsonObject(prompt) {
  const client = await getClient();
  for (const modelName of JSON_MODELS_CASCADE) {
    try {
      const res = await withRetry(async () => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: 'application/json' },
        });
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
      }, 1, 600);
      if (res) return res;
    } catch (err) {
      console.warn(`[gemini.generateJsonObject] ${modelName} failed (${err.message}), trying next...`);
    }
  }
  return null;
}

/**
 * JSON-array generation for idea extraction (src/memory/pipeline.js).
 */
export async function generateJsonArray(prompt) {
  const client = await getClient();
  for (const modelName of JSON_MODELS_CASCADE) {
    try {
      const res = await withRetry(async () => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: 'application/json' },
        });
        const result = await model.generateContent(prompt);
        const parsed = JSON.parse(result.response.text());
        return Array.isArray(parsed) ? parsed : [];
      }, 1, 600);
      if (res && res.length > 0) return res;
    } catch (err) {
      console.warn(`[gemini.generateJsonArray] ${modelName} failed (${err.message}), trying next...`);
    }
  }
  return [];
}

/**
 * Real-time Idea Extractor for active user turns.
 * Analyzes conversation text and extracts 1-3 structured sparks.
 */
export async function extractIdeasFromText(text) {
  if (!text || text.length < 15) return [];
  const prompt = `Analyze this thought or journal message. Extract 1 to 3 atomic idea sparks in JSON array format:
[{"type": "spark" | "insight" | "action" | "question", "text": "concise distilled insight under 15 words"}]
Only return the valid JSON array.\n\nMessage: "${text}"`;

  try {
    const array = await generateJsonArray(prompt);
    return Array.isArray(array) && array.length > 0 ? array : [{ type: 'spark', text: text.slice(0, 60) }];
  } catch (err) {
    return [{ type: 'spark', text: text.slice(0, 60) }];
  }
}
