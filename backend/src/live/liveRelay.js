// src/live/liveRelay.js
//
// Article 8 (Voice / Live API Sessions): the browser NEVER talks to the
// Gemini Live API directly. It opens a WebSocket to THIS relay only. This
// relay verifies the Firebase ID token first, THEN — and only then —
// opens the upstream Live API session using the server-held Gemini key.
// The key never reaches client-executable code.
//
// NOTE ON THE LIVE API SURFACE: the Gemini Live API (real-time bidirectional
// audio) is a fast-moving surface. This implementation uses the documented
// shape of the official `@google/genai` Node SDK's `ai.live.connect(...)`
// as of this build. Verify the exact model name and message shape against
// Google AI Studio's current "Stream" tab / Live API docs before your
// demo — see MEMORY_AND_VOICE_ARCHITECTURE.md section 3 for details. The
// security boundary below (verify-before-connect, uid scoping, no key on
// the client) is stable regardless of any such API drift.

import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import { verifyToken, db, FieldValue } from '../firebaseAdmin.js';
import { getGeminiApiKey } from '../secretManager.js';
import { loadMemoryContext, buildSystemPreamble, appendIdeasForEntry } from '../memory/pipeline.js';
import { generateJsonArray, summarizeConversation } from '../gemini.js';

const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-latest';
const AUTH_TIMEOUT_MS = 10_000;
const IDEA_EXTRACTION_TURN_INTERVAL = 3; // extract ideas every N model turns

// Ensure at most ONE active Live API session exists per user at any time
const activeUserSessions = new Map(); // uid -> { clientSocket, liveSession }

export function attachVoiceRelay(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = (req.url || '').split('?')[0].replace(/\/$/, '');
    if (pathname !== '/ws/voice') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (clientSocket) => {
    handleConnection(clientSocket).catch((err) => {
      console.error('[liveRelay] unhandled connection error:', err.message);
      try {
        clientSocket.close(1011, 'Internal error');
      } catch {}
    });
  });

  return wss;
}

async function handleConnection(clientSocket) {
  // 1. Require the Firebase ID token as the FIRST message on the socket.
  //    No upstream Live API connection is opened before this succeeds.
  const authData = await waitForVerifiedAuth(clientSocket);
  if (!authData || !authData.uid) return; // waitForVerifiedAuth already closed the socket
  const { uid, language = 'en' } = authData;
  let currentLanguage = language;

  // Terminate any previous session for this user to guarantee strictly one live session
  if (activeUserSessions.has(uid)) {
    const prev = activeUserSessions.get(uid);
    console.log('[liveRelay] closing previous duplicate session for uid=%s', uid);
    try { prev.liveSession?.close(); } catch {}
    try { prev.clientSocket?.close(1000, 'Superseded by new session'); } catch {}
    activeUserSessions.delete(uid);
  }

  let transcriptBuffer = [];
  let modelTurnCount = 0;
  let liveSession = null;
  const sessionId = 'voice_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  let hasSaved = false;

  try {
    // 2. Load this uid's own layered memory — never another user's.
    const memoryContext = await loadMemoryContext(uid);
    const preamble = buildSystemPreamble(memoryContext);

    const apiKey = await getGeminiApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const langInstruction = currentLanguage === 'multi'
      ? '5. LANGUAGE MANDATE: Multilingual mode is ACTIVE. Detect whatever language the user speaks (English, Spanish, French, Hindi, Tamil, German, Japanese, etc.) and respond fluently, naturally, and warmly in that exact same spoken language.'
      : '5. LANGUAGE MANDATE: English mode is ACTIVE. You must strictly converse and respond in fluent, natural English at all times, regardless of background noise.';

    liveSession = await ai.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Aoede',
            },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        realtimeInputConfig: {
          automaticActivityDetection: {
            prefixPaddingMs: 300,
            silenceDurationMs: 1200,
          },
        },
        systemInstruction: `You are Tendril, a warm, intuitive, and deeply empathetic personal voice journaling companion engaging in real-time spoken conversation.

CRITICAL SPOKEN CONVERSATION RULES:
1. VOICE TONE: Speak in a calm, gentle, warm, and natural human conversational voice.
2. CONCISENESS: Keep spoken turns concise and conversational (2 to 3 spoken sentences maximum). Speak naturally with relaxed pacing, never rushed or clinical.
3. EMPATHY & PRESENCE: Deeply validate and reflect what the user shared with genuine emotional depth.
4. MANDATORY INTUITIVE QUESTION: ALWAYS conclude your spoken turn by asking ONE gentle, open-ended, and thought-provoking question that invites the user to explore their feelings, thoughts, or desires deeper. Never end a turn with a flat statement.
5. NO FORMATTING: Never recite bullet points, list items, markdown, asterisks, or technical jargon. Speak warmly as a trusted friend.
${langInstruction}

${preamble ? `Personalized Context:\n${preamble}` : ''}`,
      },
      callbacks: {
        onopen: () => {
          console.log('[liveRelay] upstream session connected for uid=%s', uid);
        },
        onmessage: (message) => onUpstreamMessage(message),
        onerror: (err) => {
          console.error('[liveRelay] upstream error for uid=%s:', uid, err.message);
          safeSend(clientSocket, { type: 'error', error: 'Voice session error.' });
        },
        onclose: () => {
          console.log('[liveRelay] upstream session closed for uid=%s', uid);
          if (activeUserSessions.get(uid)?.clientSocket === clientSocket) {
            activeUserSessions.delete(uid);
          }
          safeClose(clientSocket, 1000, 'Upstream closed');
        },
      },
    });

    if (clientSocket.readyState !== 1) { // 1 = OPEN
      console.log('[liveRelay] client disconnected before upstream connected for uid=%s', uid);
      try { liveSession?.close(); } catch {}
      return;
    }

    activeUserSessions.set(uid, { clientSocket, liveSession });

    // 3. Confirm to client that auth AND upstream live session are ready.
    safeSend(clientSocket, { type: 'auth_ok' });

    // Requirement 3a: surface today's ideas immediately on session start.
    safeSend(clientSocket, {
      type: 'ideas',
      ideas: memoryContext.todaysIdeas,
      source: 'memory',
    });
  } catch (err) {
    console.error('[liveRelay] failed to open upstream session for uid=%s:', uid, err.message);
    safeSend(clientSocket, { type: 'error', error: 'Could not start voice session.' });
    clientSocket.close(1011, 'Upstream connect failed');
    return;
  }

  function onUpstreamMessage(message) {
    // 1. Barge-in notification: user spoke while model was responding
    if (message?.serverContent?.interrupted) {
      safeSend(clientSocket, { type: 'interrupted' });
      return;
    }

    // 2. Stream downstream 24kHz PCM audio chunks to the browser
    if (message?.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          safeSend(clientSocket, { type: 'audio_chunk', data: part.inlineData.data });
        }
      }
    }

    // 3. Spoken output audio transcription delta from Gemini Live (model speech)
    if (message?.serverContent?.outputTranscription?.text) {
      const text = message.serverContent.outputTranscription.text;
      safeSend(clientSocket, { type: 'transcription', role: 'assistant', text });
      
      const last = transcriptBuffer[transcriptBuffer.length - 1];
      if (last && last.role === 'assistant') {
        last.text += text;
      } else {
        transcriptBuffer.push({ role: 'assistant', text });
      }
    }

    // 4. User speech audio transcription delta from Gemini Live ASR
    if (message?.serverContent?.inputTranscription?.text) {
      const text = message.serverContent.inputTranscription.text;
      safeSend(clientSocket, { type: 'transcription', role: 'user', text });

      const last = transcriptBuffer[transcriptBuffer.length - 1];
      if (last && last.role === 'user') {
        last.text += text;
      } else {
        transcriptBuffer.push({ role: 'user', text });
      }
    }

    // 5. Filter out internal model thoughts (skip if outputTranscription already captured spoken response or if text is thought)
    if (message?.serverContent?.modelTurn?.parts) {
      const parts = message.serverContent.modelTurn.parts;
      const nonThoughtText = parts
        .filter((p) => !p.thought && p.text && !p.text.startsWith('**') && !p.text.includes('**Choosing a Response**'))
        .map((p) => p.text)
        .join(' ')
        .trim();
      // Only append if we haven't already captured output transcription for this turn
      const last = transcriptBuffer[transcriptBuffer.length - 1];
      if (nonThoughtText && (!last || last.role !== 'assistant' || (!last.text && !message?.serverContent?.outputTranscription))) {
        if (!message?.serverContent?.outputTranscription) {
          safeSend(clientSocket, { type: 'transcription', role: 'assistant', text: nonThoughtText });
        }
        if (last && last.role === 'assistant') {
          last.text += ' ' + nonThoughtText;
        } else {
          transcriptBuffer.push({ role: 'assistant', text: nonThoughtText });
        }
      }
    }

    // 6. Turn completion signal
    if (message?.serverContent?.turnComplete) {
      safeSend(clientSocket, { type: 'turn_complete' });
      modelTurnCount += 1;
      if (modelTurnCount % IDEA_EXTRACTION_TURN_INTERVAL === 0) {
        extractAndSendIdeas();
      }
    }
  }

  async function persistLiveVoiceEntry() {
    if (transcriptBuffer.length === 0) return;
    const hasUserSpeech = transcriptBuffer.some((m) => m.role === 'user' && m.text?.trim());
    if (!hasUserSpeech) return;

    try {
      const cleanMessages = transcriptBuffer.filter((m) => m.text?.trim());
      if (cleanMessages.length === 0) return;

      const summaryObj = await summarizeConversation(cleanMessages);
      const entryRef = db.collection('users').doc(uid).collection('entries').doc(sessionId);

      const entryData = {
        title: summaryObj.title || 'Voice Reflection',
        summary: summaryObj.summary || 'Spoken reflection with Gemini.',
        mood: summaryObj.mood || 'neutral',
        themes: summaryObj.themes || [],
        cognitiveReframing: summaryObj.cognitiveReframing || '',
        actionItems: summaryObj.actionItems || [],
        messages: cleanMessages,
        source: 'gemini-live',
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (!hasSaved) {
        entryData.createdAt = FieldValue.serverTimestamp();
      }

      await entryRef.set(entryData, { merge: true });
      hasSaved = true;

      appendIdeasForEntry(uid, {
        title: entryData.title,
        summary: entryData.summary,
        mood: entryData.mood,
        messages: cleanMessages,
      });

      console.log('[liveRelay] Successfully auto-saved voice entry uid=%s doc=%s (turns=%d)', uid, sessionId, cleanMessages.length);
    } catch (err) {
      console.warn('[liveRelay] Auto-save voice entry failed:', err.message);
    }
  }

  async function extractAndSendIdeas() {
    if (transcriptBuffer.length === 0) return;
    try {
      const prompt = `From this live voice conversation so far, extract 1-3
short "idea" bullets worth surfacing to the user right now. Each under 15
words. Return ONLY a JSON array of strings.\n\n${transcriptBuffer
        .map((m) => `${m.role}: ${m.text}`)
        .join('\n')}`;
      const ideas = await generateJsonArray(prompt);
      if (ideas.length > 0) {
        safeSend(clientSocket, { type: 'ideas', ideas, source: 'live' });
      }
    } catch (err) {
      console.error('[liveRelay] idea extraction failed:', err.message);
    }
  }

  clientSocket.on('message', (raw) => {
    let payload;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      return; // ignore malformed frames rather than crashing the socket
    }

    if (payload.type === 'ping') {
      safeSend(clientSocket, { type: 'pong' });
      return;
    }

    if (payload.type === 'audio_chunk' && payload.data) {
      // payload.data: base64-encoded 16kHz 16-bit linear PCM audio (~100ms chunks)
      // Gemini Live API strictly requires audio/pcm;rate=16000
      if (liveSession) {
        try {
          liveSession.sendRealtimeInput({
            audio: { data: payload.data, mimeType: 'audio/pcm;rate=16000' },
          });
        } catch (err) {
          console.warn('[liveRelay] failed to send realtime audio:', err.message);
        }
      }
    } else if (payload.type === 'audio_stream_end') {
      // Direct signal to Gemini VAD that audio input has paused or finished
      if (liveSession) {
        try {
          liveSession.sendRealtimeInput({ audioStreamEnd: true });
        } catch (err) {
          console.warn('[liveRelay] failed to send audioStreamEnd:', err.message);
        }
      }
    } else if (payload.type === 'init_prompt') {
      if (liveSession) {
        try {
          liveSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: payload.text || "Hello Tendril! Greet me warmly and concisely ask how I am feeling today or what is on my mind in one short sentence." }] }],
            turnComplete: true,
          });
        } catch (err) {
          console.warn('[liveRelay] failed to send init prompt:', err.message);
        }
      }
    } else if (payload.type === 'text_message' && payload.text) {
      // Lets the user type mid-voice-session (mode toggle parity).
      transcriptBuffer.push({ role: 'user', text: payload.text });
      if (liveSession) {
        try {
          liveSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: payload.text }] }],
            turnComplete: true,
          });
        } catch (err) {
          console.warn('[liveRelay] failed to send client content:', err.message);
        }
      }
    } else if (payload.type === 'set_language' && payload.language) {
      currentLanguage = payload.language;
      console.log('[liveRelay] updated session language to %s for uid=%s', currentLanguage, uid);
    } else if (payload.type === 'save_session') {
      persistLiveVoiceEntry().catch(() => {});
    } else if (payload.type === 'end_session') {
      clientSocket.close(1000, 'Client ended session');
    }
  });

  clientSocket.on('close', (code, reason) => {
    console.log('[liveRelay] clientSocket closed code=%s reason=%s for uid=%s', code, reason?.toString(), uid);
    if (activeUserSessions.get(uid)?.clientSocket === clientSocket) {
      activeUserSessions.delete(uid);
    }
    try {
      liveSession?.close();
    } catch {}
    liveSession = null;
  });
}

function waitForVerifiedAuth(clientSocket) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      clientSocket.close(4401, 'Auth timeout');
      resolve(null);
    }, AUTH_TIMEOUT_MS);

    clientSocket.once('message', async (raw) => {
      clearTimeout(timeout);
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.type !== 'auth' || !payload.idToken) {
          clientSocket.close(4401, 'First message must be auth');
          return resolve(null);
        }
        // Reuses the exact same verification path as HTTP requests
        // (Article 2) — construct the "Bearer <token>" shape verifyToken
        // expects.
        const uid = await verifyToken(`Bearer ${payload.idToken}`);
        resolve({ uid, language: payload.language || 'en' });
      } catch (err) {
        clientSocket.close(4401, 'Invalid token');
        resolve(null);
      }
    });
  });
}

function safeSend(socket, obj) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

function safeClose(socket, code, reason) {
  try {
    socket.close(code, reason);
  } catch {}
}
