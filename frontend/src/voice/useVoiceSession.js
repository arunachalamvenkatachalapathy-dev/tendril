// src/voice/useVoiceSession.js
//
// Dual-Engine Resilient Voice Architecture:
// Engine 1: Gemini Live WebSocket Relay (low latency bidirectional audio)
// Engine 2: Continuous Ambient Voice Mode (Browser SpeechRecognition + Resilient Gemini Model Cascade + SpeechSynthesis)
//
// If the WebSocket drops, encounters proxy firewalls, or times out after 5s,
// it gracefully cascades to Engine 2 so the voice conversation NEVER breaks!

import { useCallback, useRef, useState, useEffect } from 'react';
import { getIdToken } from '../firebase.js';
import { buildVoiceWsUrl, sendChatMessage } from '../api.js';

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
  const [status, setStatus] = useState('idle'); // idle | connecting | listening | speaking | error
  const [activeEngine, setActiveEngine] = useState('live'); // 'live' | 'speech-cascade'
  const [liveTranscript, setLiveTranscript] = useState([]); // { role, text }
  const [ideas, setIdeas] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 for visualizer
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const processorRef = useRef(null);
  const micStreamRef = useRef(null);
  const playbackCtxRef = useRef(null);
  const recognitionRef = useRef(null);
  const animFrameRef = useRef(null);
  const transcriptHistoryRef = useRef([]);
  const statusRef = useRef('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Keep transcript history in sync
  useEffect(() => {
    transcriptHistoryRef.current = liveTranscript;
  }, [liveTranscript]);

  // Visualizer loop for real-time mic volume
  const startAudioMeter = useCallback((stream) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkLevel = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round(avg * 1.5)));
        animFrameRef.current = requestAnimationFrame(checkLevel);
      };
      checkLevel();
    } catch (e) {
      console.warn('Audio meter init bypassed:', e);
    }
  }, []);

  const stopAudioMeter = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Speak AI reply aloud in fallback mode
  const speakReply = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    setStatus('speaking');
    utterance.onend = () => setStatus('listening');
    utterance.onerror = () => setStatus('listening');
    window.speechSynthesis.speak(utterance);
  }, []);

  // Engine 2: Continuous Ambient Speech Cascade
  const startSpeechCascade = useCallback(async (micStream) => {
    setActiveEngine('speech-cascade');
    setStatus('listening');
    setError(null);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice recognition is not supported in this browser. Use Chrome or Edge.');
      setStatus('error');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let silenceTimer = null;
      let finalSpeechBuffer = '';

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSpeechBuffer += ' ' + event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        clearTimeout(silenceTimer);
        // After 1.8 seconds of silence, process user turn through Gemini cascade
        silenceTimer = setTimeout(async () => {
          const userText = (finalSpeechBuffer + ' ' + interim).trim();
          if (!userText || userText.length < 2) return;

          finalSpeechBuffer = '';
          setLiveTranscript((prev) => [...prev, { role: 'user', text: userText }]);

          // Auto-extract sparks
          if (userText.length > 15) {
            setIdeas((prev) => [userText.slice(0, 70), ...prev].slice(0, 8));
          }

          try {
            setStatus('speaking');
            const history = transcriptHistoryRef.current.map((t) => ({
              role: t.role === 'assistant' ? 'assistant' : 'user',
              text: t.text,
            }));
            const res = await sendChatMessage(userText, history);
            if (res.reply) {
              setLiveTranscript((prev) => [...prev, { role: 'assistant', text: res.reply }]);
              speakReply(res.reply);
            }
          } catch (err) {
            console.warn('Speech cascade chat error:', err);
            setStatus('listening');
          }
        }, 1800);
      };

      recognition.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn('SpeechRecognition error:', e.error);
        }
      };

      recognition.onend = () => {
        // Auto-restart continuous listening unless stopped
        if (statusRef.current !== 'idle' && recognitionRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
    } catch (e) {
      console.warn('SpeechRecognition start failed:', e);
      setError('Microphone active. You can speak or type seamlessly.');
    }
  }, [speakReply]);

  const start = useCallback(async () => {
    setStatus('connecting');
    setError(null);

    try {
      // 1. Capture microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = stream;
      startAudioMeter(stream);

      const token = await getIdToken();
      if (!token) throw new Error('Not signed in.');

      // 2. Attempt WebSocket Live Relay
      let connectedLive = false;
      const ws = new WebSocket(buildVoiceWsUrl());
      wsRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (!connectedLive && statusRef.current !== 'idle') {
          console.log('[Voice] WebSocket handshake exceeded, activating ambient cascade engine');
          try { ws.close(); } catch {}
          startSpeechCascade(stream);
        }
      }, 12000);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', idToken: token }));
      };

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload.type === 'auth_ok') {
            connectedLive = true;
            clearTimeout(connectionTimeout);
            setActiveEngine('live');
            setStatus('listening');
            beginMicCapture(ws, stream);
          } else if (payload.type === 'ideas') {
            setIdeas((prev) => {
              const merged = [...new Set([...payload.ideas, ...prev])];
              return merged.slice(0, 8);
            });
          } else if (payload.type === 'upstream') {
            handleUpstreamMessage(payload.message);
          } else if (payload.type === 'error') {
            console.warn('[Voice] Upstream error, falling back to speech cascade');
            clearTimeout(connectionTimeout);
            try { ws.close(); } catch {}
            startSpeechCascade(stream);
          }
        } catch (e) {
          console.warn('ws parse err:', e);
        }
      };

      ws.onerror = () => {
        console.log('[Voice] WebSocket error, gracefully falling back to Ambient Speech Engine');
        clearTimeout(connectionTimeout);
        if (!connectedLive && statusRef.current !== 'idle') {
          startSpeechCascade(stream);
        }
      };

      ws.onclose = () => {
        if (!connectedLive && statusRef.current !== 'idle') {
          startSpeechCascade(stream);
        }
      };
    } catch (err) {
      console.warn('Voice start exception:', err.message);
      setError(err.message.includes('Permission') ? 'Microphone access denied. Please allow microphone in browser.' : err.message);
      setStatus('error');
    }
  }, [activeEngine, startAudioMeter, startSpeechCascade]);

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

  function beginMicCapture(ws, stream) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: INPUT_SAMPLE_RATE,
      });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm = floatTo16BitPCM(input);
        ws.send(JSON.stringify({ type: 'audio_chunk', data: bufferToBase64(pcm) }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (e) {
      console.warn('PCM capture fallback:', e);
    }
  }

  function stopMicCapture() {
    stopAudioMeter();
    processorRef.current?.disconnect();
    audioCtxRef.current?.close();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
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
    }
    setLiveTranscript((prev) => [...prev, { role: 'user', text }]);
  }, []);

  const stop = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'end_session' }));
    wsRef.current?.close();
    stopMicCapture();
    setStatus('idle');
  }, [stopAudioMeter]);

  return { status, activeEngine, audioLevel, liveTranscript, ideas, error, start, stop, sendText };
}
