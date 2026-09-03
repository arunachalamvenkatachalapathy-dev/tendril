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
import { verifyToken } from '../firebaseAdmin.js';
import { getGeminiApiKey } from '../secretManager.js';
import { loadMemoryContext, buildSystemPreamble } from '../memory/pipeline.js';
import { generateJsonArray } from '../gemini.js';

const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
const AUTH_TIMEOUT_MS = 10_000;
const IDEA_EXTRACTION_TURN_INTERVAL = 3; // extract ideas every N model turns

export function attachVoiceRelay(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws/voice') {
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
  const uid = await waitForVerifiedUid(clientSocket);
  if (!uid) return; // waitForVerifiedUid already closed the socket

  let transcriptBuffer = [];
  let modelTurnCount = 0;
  let liveSession = null;

  try {
    // 2. Load this uid's own layered memory — never another user's.
    const memoryContext = await loadMemoryContext(uid);
    const preamble = buildSystemPreamble(memoryContext);

    // Requirement 3a: surface today's ideas immediately on session start.
    clientSocket.send(
      JSON.stringify({ type: 'ideas', ideas: memoryContext.todaysIdeas, source: 'memory' })
    );

    const apiKey = await getGeminiApiKey();
    const ai = new GoogleGenAI({ apiKey });

    liveSession = await ai.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: preamble
          ? `You are a warm, non-judgmental voice journaling companion. ${preamble}`
          : 'You are a warm, non-judgmental voice journaling companion.',
      },
      callbacks: {
        onmessage: (message) => onUpstreamMessage(message),
        onerror: (err) => {
          console.error('[liveRelay] upstream error for uid=%s:', uid, err.message);
          safeSend(clientSocket, { type: 'error', error: 'Voice session error.' });
        },
        onclose: () => {
          safeClose(clientSocket, 1000, 'Upstream closed');
        },
      },
    });
  } catch (err) {
    console.error('[liveRelay] failed to open upstream session for uid=%s:', uid, err.message);
    safeSend(clientSocket, { type: 'error', error: 'Could not start voice session.' });
    clientSocket.close(1011, 'Upstream connect failed');
    return;
  }

  function onUpstreamMessage(message) {
    // Relay audio/text back to the browser as-is (base64 audio chunks,
    // transcription text, turnComplete flags) — shape follows the SDK's
    // LiveServerMessage; adjust field names if the SDK version differs.
    safeSend(clientSocket, { type: 'upstream', message });

    if (message?.serverContent?.modelTurn) {
      const parts = message.serverContent.modelTurn.parts || [];
      const text = parts.map((p) => p.text).filter(Boolean).join(' ');
      if (text) transcriptBuffer.push({ role: 'assistant', text });
    }

    if (message?.serverContent?.turnComplete) {
      modelTurnCount += 1;
      if (modelTurnCount % IDEA_EXTRACTION_TURN_INTERVAL === 0) {
        extractAndSendIdeas();
      }
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

    if (payload.type === 'audio_chunk' && payload.data) {
      // payload.data: base64 PCM16 audio, 16kHz mono, from the browser.
      liveSession.sendRealtimeInput({
        audio: { data: payload.data, mimeType: 'audio/pcm;rate=16000' },
      });
    } else if (payload.type === 'text_message' && payload.text) {
      // Lets the user type mid-voice-session (mode toggle parity).
      transcriptBuffer.push({ role: 'user', text: payload.text });
      liveSession.sendClientContent({ turns: [{ role: 'user', parts: [{ text: payload.text }] }] });
    } else if (payload.type === 'end_session') {
      clientSocket.close(1000, 'Client ended session');
    }
  });

  clientSocket.on('close', () => {
    try {
      liveSession?.close();
    } catch {}
  });
}

function waitForVerifiedUid(clientSocket) {
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
        clientSocket.send(JSON.stringify({ type: 'auth_ok' }));
        resolve(uid);
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
