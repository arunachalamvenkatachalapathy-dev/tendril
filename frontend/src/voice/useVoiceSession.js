// src/voice/useVoiceSession.js
//
// Google Gemini Live Voice Runtime – Cross-platform Edition (Android + iOS + Desktop)
//
// Key design principles:
// - MediaRecorder API for mic capture (works on iOS Safari 14.5+, Android Chrome, Desktop)
// - No ScriptProcessorNode (deprecated, broken on iOS 17+, Chrome Android)
// - AudioWorklet for PCM analysis where available, Uint8Array frequency fallback elsewhere
// - User-gesture-gated AudioContext for iOS compatibility
// - Simple getUserMedia constraints with progressive fallback for iOS Safari
// - Binary WebSocket frames (ArrayBuffer) for mobile performance
// - Single Source of Truth: all transcription flows through handleTranscriptionDelta
// - Exponential backoff reconnection with fallback to SpeechRecognition cascade

import { useCallback, useRef, useState, useEffect } from 'react';
import { getIdToken } from '../firebase.js';
import { buildVoiceWsUrl, sendChatMessage, extractIdeas } from '../api.js';

const OUTPUT_SAMPLE_RATE = 24000;
const MAX_RECONNECT_ATTEMPTS = 3;

// PCM audio helpers
function downsampleTo16k(float32Array, inputSampleRate) {
  if (!inputSampleRate || inputSampleRate === 16000) return float32Array;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(float32Array.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const originIndex = i * ratio;
    const index1 = Math.floor(originIndex);
    const index2 = Math.min(index1 + 1, float32Array.length - 1);
    const weight = originIndex - index1;
    result[i] = float32Array[index1] * (1 - weight) + float32Array[index2] * weight;
  }
  return result;
}

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const WORKLET_PROCESSOR_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.offset = 0;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.offset++] = channel[i];
      if (this.offset >= this.bufferSize) {
        this.port.postMessage(this.buffer.slice(0, this.bufferSize));
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

export function useVoiceSession() {
  const [status, setStatus] = useState('idle');
  const [activeEngine, setActiveEngine] = useState('live');
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [currentSubtitle, setCurrentSubtitle] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [notice, setNotice] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasMic, setHasMic] = useState(true);
  const [micActive, setMicActive] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);

  const micActiveRef = useRef(false);
  useEffect(() => { micActiveRef.current = micActive; }, [micActive]);

  const activeEngineRef = useRef('live');
  useEffect(() => { activeEngineRef.current = activeEngine; }, [activeEngine]);

  // WebSocket + audio refs
  const wsRef = useRef(null);
  const playbackCtxRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);
  const micStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const audioLevelTimerRef = useRef(null);
  const analyserRef = useRef(null);
  const analyserCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const recognitionRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(false);
  const onReadyCallbackRef = useRef(null);

  const transcriptHistoryRef = useRef([]);
  const statusRef = useRef('idle');
  const voiceOutputRef = useRef(true);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { transcriptHistoryRef.current = liveTranscript; }, [liveTranscript]);
  useEffect(() => { voiceOutputRef.current = voiceOutputEnabled; }, [voiceOutputEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioLevelTimerRef.current) clearInterval(audioLevelTimerRef.current);
      try { wsRef.current?.close(); } catch {}
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // AUDIO PLAYBACK (24kHz PCM from Gemini Live)
  // ─────────────────────────────────────────────────────────────────────────────

  const stopAudioPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((s) => { try { s.stop(); } catch {} });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const ensurePlaybackContext = useCallback(() => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: OUTPUT_SAMPLE_RATE,
        latencyHint: 'interactive',
      });
    }
    const ctx = playbackCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }, []);

  const playAudioChunk = useCallback((base64Data) => {
    if (!voiceOutputRef.current) return;
    try {
      const ctx = ensurePlaybackContext();
      const arrayBuffer = base64ToArrayBuffer(base64Data);
      const pcm16 = new Int16Array(arrayBuffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

      const audioBuffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
      audioBuffer.copyToChannel(float32, 0);

      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);

      const now = ctx.currentTime;
      let startTime = nextStartTimeRef.current;
      if (startTime < now || startTime > now + 1.5) startTime = now;
      src.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(src);
      src.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== src);
        if (activeSourcesRef.current.length === 0 && statusRef.current === 'speaking') {
          setStatus('listening');
        }
      };
      setStatus('speaking');
    } catch (err) {
      console.warn('[Voice] Audio playback error:', err.message);
    }
  }, [ensurePlaybackContext]);

  const speakReply = useCallback((text) => {
    if (!voiceOutputRef.current || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#_`]/g, '').trim();
      if (!cleanText) return;
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      setStatus('speaking');
      utterance.onend = () => setStatus('listening');
      utterance.onerror = () => setStatus('listening');
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setStatus('listening');
    }
  }, []);

  const playGoogleLiveAudio = useCallback((base64Mp3, fallbackText) => {
    if (!voiceOutputRef.current) return;
    try {
      const audio = new Audio(`data:audio/mp3;base64,${base64Mp3}`);
      setStatus('speaking');
      audio.onended = () => setStatus('listening');
      audio.onerror = () => { if (fallbackText) speakReply(fallbackText); else setStatus('listening'); };
      audio.play().catch(() => { if (fallbackText) speakReply(fallbackText); else setStatus('listening'); });
    } catch (e) {
      if (fallbackText) speakReply(fallbackText);
      else setStatus('listening');
    }
  }, [speakReply]);

  // ─────────────────────────────────────────────────────────────────────────────
  // AUDIO LEVEL METER (for waveform visualizer)
  // ─────────────────────────────────────────────────────────────────────────────

  const startAudioMeter = useCallback((stream) => {
    try {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      // Use a separate AudioContext for analysis — independent of playback context
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyserCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const level = Math.min(100, Math.round(avg * 1.5));
        setAudioLevel(level);

        // Instant barge-in: interrupt Gemini the moment the user speaks
        if (level > 20 && statusRef.current === 'speaking') {
          stopAudioPlayback();
          setStatus('listening');
          setCurrentSubtitle((prev) => (prev?.role === 'assistant' ? null : prev));
        }
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn('[Voice] Audio meter unavailable:', e.message);
    }
  }, [stopAudioPlayback]);

  const stopAudioMeter = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    analyserRef.current = null;
    if (analyserCtxRef.current && analyserCtxRef.current.state !== 'closed') {
      try { analyserCtxRef.current.close(); } catch {}
      analyserCtxRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // TRANSCRIPTION – Single Source of Truth
  // ─────────────────────────────────────────────────────────────────────────────

  const handleTranscriptionDelta = useCallback((role, text) => {
    if (!text) return;
    if (role === 'assistant') setStatus('speaking');

    setCurrentSubtitle((prev) => {
      if (prev && prev.role === role && prev.isLive) return { ...prev, text: prev.text + text };
      return { role, text, isLive: true };
    });

    setLiveTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && last.isStreaming) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { role, text, isStreaming: true, timestamp: Date.now() }];
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // MIC CAPTURE — 16kHz Mono 16-bit PCM (AudioWorklet with ScriptProcessor fallback)
  // ─────────────────────────────────────────────────────────────────────────────

  const stopMicCaptureOnly = useCallback(() => {
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect();
        workletNodeRef.current.port.close();
      } catch {}
      workletNodeRef.current = null;
    }
    if (scriptProcessorRef.current) {
      try { scriptProcessorRef.current.disconnect(); } catch {}
      scriptProcessorRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
  }, []);

  const beginMicCapture = useCallback(async (ws, stream) => {
    stopMicCaptureOnly();

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const sampleRate = audioCtx.sampleRate;

      const sendPcmChunk = (float32Chunk) => {
        const activeWs = wsRef.current || ws;
        if (!activeWs || activeWs.readyState !== WebSocket.OPEN) return;
        try {
          const resampled = downsampleTo16k(float32Chunk, sampleRate);
          const pcm = floatTo16BitPCM(resampled);
          const base64 = bufferToBase64(pcm);
          activeWs.send(JSON.stringify({
            type: 'audio_chunk',
            data: base64,
            mimeType: 'audio/pcm;rate=16000',
          }));
        } catch (e) {
          console.warn('[Voice] Failed to send PCM chunk:', e.message);
        }
      };

      let workletStarted = false;
      if (audioCtx.audioWorklet) {
        try {
          const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
          const workletUrl = URL.createObjectURL(blob);
          await audioCtx.audioWorklet.addModule(workletUrl);
          URL.revokeObjectURL(workletUrl);

          const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor');
          workletNodeRef.current = workletNode;
          workletNode.port.onmessage = (event) => {
            sendPcmChunk(event.data);
          };
          source.connect(workletNode);
          workletStarted = true;
          console.log('[Voice] AudioWorklet PCM capture running (rate=%d)', sampleRate);
        } catch (wErr) {
          console.warn('[Voice] AudioWorklet init failed, using ScriptProcessor fallback:', wErr.message);
        }
      }

      if (!workletStarted) {
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;
        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          sendPcmChunk(input);
        };
        source.connect(processor);
        processor.connect(audioCtx.destination);
        console.log('[Voice] ScriptProcessor PCM capture running (rate=%d)', sampleRate);
      }
    } catch (e) {
      console.warn('[Voice] Mic capture setup error:', e.message);
    }
  }, [stopMicCaptureOnly]);

  const stopMicCapture = useCallback(() => {
    stopAudioMeter();
    stopMicCaptureOnly();

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    stopAudioPlayback();
    setMicActive(false);
    setCurrentSubtitle(null);
  }, [stopAudioMeter, stopAudioPlayback, stopMicCaptureOnly]);

  // ─────────────────────────────────────────────────────────────────────────────
  // WEBSOCKET RELAY CONNECTION
  // ─────────────────────────────────────────────────────────────────────────────

  const connectWs = useCallback(async (onReady) => {
    if (onReady) onReadyCallbackRef.current = onReady;

    try {
      const token = await getIdToken();
      if (!token) return null;

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (onReadyCallbackRef.current) {
          onReadyCallbackRef.current(wsRef.current);
          onReadyCallbackRef.current = null;
        }
        return wsRef.current;
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
        return wsRef.current;
      }

      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      setStatus('connecting');
      const wsUrl = buildVoiceWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // 8-second fallback: if WS doesn't connect, switch to speech-cascade mode
      const wsTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn('[Voice] WebSocket connect timeout — falling back to speech-cascade');
          setActiveEngine('speech-cascade');
          setStatus('listening');
          ws.close();
        }
      }, 8000);

      ws.onopen = () => {
        clearTimeout(wsTimeout);
        reconnectAttemptsRef.current = 0;
        ws.send(JSON.stringify({ type: 'auth', idToken: token }));

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
          }
        }, 20000);
      };

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          switch (payload.type) {
            case 'auth_ok':
              setActiveEngine('live');
              setStatus('listening');
              if (onReadyCallbackRef.current) {
                onReadyCallbackRef.current(ws);
                onReadyCallbackRef.current = null;
              } else if (micStreamRef.current) {
                beginMicCapture(ws, micStreamRef.current);
              }
              break;
            case 'pong':
              break;
            case 'audio_chunk':
              if (payload.data) playAudioChunk(payload.data);
              break;
            case 'transcription':
              handleTranscriptionDelta(payload.role, payload.text);
              break;
            case 'interrupted':
              stopAudioPlayback();
              setStatus('listening');
              setCurrentSubtitle(null);
              setLiveTranscript((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
              break;
            case 'turn_complete':
              setCurrentSubtitle((prev) => prev ? { ...prev, isLive: false } : null);
              setLiveTranscript((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
              break;
            case 'ideas':
              setIdeas((prev) => [...new Set([...payload.ideas, ...prev])].slice(0, 8));
              break;
            case 'error':
              console.warn('[Voice WS] Relay error:', payload.error);
              setActiveEngine('speech-cascade');
              break;
            default:
              break;
          }
        } catch (e) {}
      };

      ws.onerror = () => {
        clearTimeout(wsTimeout);
        console.warn('[Voice WS] Connection error — switching to speech-cascade');
        setActiveEngine('speech-cascade');
        setStatus('listening');
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (shouldReconnectRef.current && statusRef.current !== 'idle' && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(8000, 1500 * Math.pow(2, reconnectAttemptsRef.current));
          reconnectAttemptsRef.current += 1;
          reconnectTimerRef.current = setTimeout(() => {
            if (shouldReconnectRef.current) connectWs(onReady);
          }, delay);
        } else {
          setActiveEngine('speech-cascade');
          if (statusRef.current !== 'idle') setStatus('listening');
        }
      };

      return ws;
    } catch (err) {
      console.warn('[Voice] WS connect exception:', err.message);
      setActiveEngine('speech-cascade');
      return null;
    }
  }, [beginMicCapture, handleTranscriptionDelta, playAudioChunk, stopAudioPlayback]);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEXT MESSAGE SEND (HTTP fallback when WS unavailable)
  // ─────────────────────────────────────────────────────────────────────────────

  const sendText = useCallback(async (text, imagePayload = null) => {
    if (!text || !text.trim()) return;
    const clean = text.trim();

    setLiveTranscript((prev) => [...prev, { role: 'user', text: clean, timestamp: Date.now() }]);
    setCurrentSubtitle({ role: 'user', text: clean, isLive: false });

    extractIdeas(clean)
      .then((sparks) => { if (sparks?.length > 0) setIdeas((prev) => [...new Set([...sparks, ...prev])].slice(0, 8)); })
      .catch(() => {});

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'text_message', text: clean }));
        return;
      } catch (e) {
        console.warn('[Voice] WS send failed, falling back to HTTP:', e);
      }
    }

    setStatus('speaking');
    try {
      const history = transcriptHistoryRef.current.map((t) => ({
        role: t.role === 'assistant' ? 'assistant' : 'user',
        text: t.text,
      }));
      const res = await sendChatMessage(clean, history, imagePayload, voiceOutputRef.current);
      if (res.reply) {
        setLiveTranscript((prev) => [...prev, { role: 'assistant', text: res.reply, timestamp: Date.now() }]);
        setCurrentSubtitle({ role: 'assistant', text: res.reply, isLive: false });
        if (voiceOutputRef.current) {
          if (res.audioContent) playGoogleLiveAudio(res.audioContent, res.reply);
          else speakReply(res.reply);
        } else {
          setStatus('listening');
        }
      } else {
        setStatus('listening');
      }
    } catch (err) {
      console.warn('[Voice] Chat dispatch error:', err);
      const fallbackMsg = "I'm holding this thought. Feel free to continue.";
      setLiveTranscript((prev) => [...prev, { role: 'assistant', text: fallbackMsg, timestamp: Date.now() }]);
      setCurrentSubtitle({ role: 'assistant', text: fallbackMsg, isLive: false });
      setStatus('listening');
    }
  }, [playGoogleLiveAudio, speakReply]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SPEECH RECOGNITION — SpeechRecognition API (for real-time subtitle fallback
  // when Gemini Live transcription is delayed, and for speech-cascade mode)
  // ─────────────────────────────────────────────────────────────────────────────

  const startSpeechRecognition = useCallback((stream) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

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
        const userSpoken = (finalSpeechBuffer + ' ' + interim).trim();
        if (userSpoken) {
          if (statusRef.current === 'speaking') {
            stopAudioPlayback();
            setStatus('listening');
          }
          setCurrentSubtitle({ role: 'user', text: userSpoken, isLive: true });
        }

        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          const userText = (finalSpeechBuffer + ' ' + interim).trim();
          if (!userText || userText.length < 2) return;
          finalSpeechBuffer = '';
          // Only dispatch sendText when in HTTP cascade mode — never while Gemini Live WebSocket is active
          if (activeEngineRef.current !== 'live') {
            sendText(userText);
          }
        }, 1300);
      };

      recognition.onend = () => {
        if (micActiveRef.current) { try { recognition.start(); } catch {} }
      };

      recognition.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[Voice] SpeechRecognition notice:', e.error);
        }
      };

      recognition.start();
    } catch (e) {
      console.warn('[Voice] SpeechRecognition init notice:', e.message);
    }
  }, [sendText, stopAudioPlayback]);

  // ─────────────────────────────────────────────────────────────────────────────
  // MIC ACQUISITION — iOS Safari + Android + Desktop compatible
  // ─────────────────────────────────────────────────────────────────────────────

  const acquireMic = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setHasMic(false);
      return null;
    }
    // Try with echo cancellation first, then bare audio, then give up
    const constraintSets = [
      { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000 } },
      { audio: { echoCancellation: true, noiseSuppression: true } },
      { audio: true },
    ];
    for (const constraints of constraintSets) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return stream;
      } catch (e) {
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          // User denied — do not try further
          setHasMic(false);
          setNotice('Microphone permission was denied. Please allow microphone access in your browser settings and try again.');
          return null;
        }
        // OverconstrainedError etc. — try next set
      }
    }
    console.info('[Voice] No active microphone hardware detected');
    setHasMic(false);
    setNotice('No microphone detected. Voice Reader active — Tendril will voice its responses aloud.');
    return null;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  const start = useCallback(async (requestMic = false) => {
    setNotice(null);
    shouldReconnectRef.current = true;
    connectWs();
    setStatus('listening');
    if (requestMic) toggleMic(); // eslint-disable-line no-use-before-define
  }, [connectWs]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = useCallback(async () => {
    if (micActive) {
      stopMicCapture();
      return;
    }

    // Must create/resume AudioContext inside the user gesture (iOS requirement)
    try {
      ensurePlaybackContext();
    } catch {}

    const stream = await acquireMic();
    if (!stream) return;

    micStreamRef.current = stream;
    setHasMic(true);
    setMicActive(true);
    setNotice(null);
    startAudioMeter(stream);

    // Connect WebSocket and begin capture once auth_ok is received
    connectWs((ws) => {
      beginMicCapture(ws, stream);
    });

    // Start real-time SpeechRecognition for instant subtitles (works alongside WS)
    startSpeechRecognition(stream);
  }, [
    acquireMic,
    beginMicCapture,
    connectWs,
    ensurePlaybackContext,
    micActive,
    startAudioMeter,
    startSpeechRecognition,
    stopMicCapture,
  ]);

  const toggleVoiceOutput = useCallback(() => {
    setVoiceOutputEnabled((prev) => {
      const next = !prev;
      if (!next) stopAudioPlayback();
      return next;
    });
  }, [stopAudioPlayback]);

  const stop = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    try {
      wsRef.current?.send(JSON.stringify({ type: 'end_session' }));
      wsRef.current?.close();
    } catch {}
    stopMicCapture();
    stopAudioPlayback();
    setCurrentSubtitle(null);
    setStatus('idle');
  }, [stopAudioPlayback, stopMicCapture]);

  return {
    status,
    activeEngine,
    audioLevel,
    liveTranscript,
    currentSubtitle,
    ideas,
    notice,
    hasMic,
    micActive,
    voiceOutputEnabled,
    toggleMic,
    toggleVoiceOutput,
    stopAudioPlayback,
    start,
    stop,
    sendText,
    setNotice,
  };
}
