// src/voice/useVoiceSession.js
//
// Manages the WebSocket connection to our backend's /ws/voice relay
// (never directly to Gemini — see Article 8). Handles: auth handshake,
// continuous mic capture (requirement 7b — no push-to-talk), streaming
// audio out, playing audio back, and surfacing live transcript + idea
// bullets to the UI.
//
// NOTE: uses ScriptProcessorNode for simplicity/time. It's deprecated in
// favor of AudioWorklet — fine for a hackathon demo, worth migrating for
// a real production build (see MEMORY_AND_VOICE_ARCHITECTURE.md).

import { useCallback, useRef, useState } from 'react';
import { getIdToken } from '../firebase.js';
import { buildVoiceWsUrl } from '../api.js';

const INPUT_SAMPLE_RATE = 16000;

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function useVoiceSession() {
  const [status, setStatus] = useState('idle'); // idle | connecting | listening | error
  const [liveTranscript, setLiveTranscript] = useState([]); // { role, text }
  const [ideas, setIdeas] = useState([]);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const micStreamRef = useRef(null);
  const playbackCtxRef = useRef(null);

  const start = useCallback(async () => {
    setStatus('connecting');
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not signed in.');

      const ws = new WebSocket(buildVoiceWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', idToken: token }));
      };

      ws.onmessage = (evt) => {
        const payload = JSON.parse(evt.data);
        if (payload.type === 'auth_ok') {
          beginMicCapture(ws).catch((err) => {
            setError(err.message);
            setStatus('error');
          });
          setStatus('listening');
        } else if (payload.type === 'ideas') {
          setIdeas((prev) => {
            const merged = [...new Set([...payload.ideas, ...prev])];
            return merged.slice(0, 8);
          });
        } else if (payload.type === 'upstream') {
          handleUpstreamMessage(payload.message);
        } else if (payload.type === 'error') {
          setError(payload.error);
        }
      };

      ws.onerror = () => setError('Voice connection error.');
      ws.onclose = () => {
        setStatus('idle');
        stopMicCapture();
      };
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, []);

  function handleUpstreamMessage(message) {
    const parts = message?.serverContent?.modelTurn?.parts || [];
    for (const part of parts) {
      if (part.text) {
        setLiveTranscript((prev) => [...prev, { role: 'assistant', text: part.text }]);
      }
      if (part.inlineData?.data) {
        playAudioChunk(part.inlineData.data);
      }
    }
  }

  async function beginMicCapture(ws) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: INPUT_SAMPLE_RATE,
    });
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    // 4096-sample buffer, mono in/out — simplest working chunk size.
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm = floatTo16BitPCM(input);
      ws.send(JSON.stringify({ type: 'audio_chunk', data: bufferToBase64(pcm) }));
    };

    source.connect(processor);
    // Connecting to destination is required by some browsers for the
    // processor to fire, even though we don't want to hear our own mic.
    processor.connect(audioCtx.destination);
  }

  function stopMicCapture() {
    processorRef.current?.disconnect();
    audioCtxRef.current?.close();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    processorRef.current = null;
    audioCtxRef.current = null;
    micStreamRef.current = null;
  }

  function playAudioChunk(base64Data) {
    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000,
      });
    }
    const ctx = playbackCtxRef.current;
    const arrayBuffer = base64ToArrayBuffer(base64Data);
    const pcm16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    src.start();
  }

  const sendText = useCallback((text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text_message', text }));
      setLiveTranscript((prev) => [...prev, { role: 'user', text }]);
    }
  }, []);

  const stop = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'end_session' }));
    wsRef.current?.close();
    stopMicCapture();
    setStatus('idle');
  }, []);

  return { status, liveTranscript, ideas, error, start, stop, sendText };
}
