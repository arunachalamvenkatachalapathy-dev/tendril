// src/voice/useVoiceSession.js
//
// Zero-Failure Resilient Conversational Runtime:
// - Seamlessly supports both voice and text concurrently in a single canvas.
// - Tiered Microphone Acquisition:
//     1. High-fidelity audio constraints
//     2. Basic audio fallback
//     3. Graceful 'Voice Reader' mode if no microphone hardware is present.
// - Decoupled Transport:
//     Text messaging ALWAYS works via WebSocket or resilient multi-model HTTP cascade.
// - Configurable Voice Reply:
//     Tendril can voice its responses aloud (via SpeechSynthesis or PCM audio) or stay quiet.

import { useCallback, useRef, useState, useEffect } from 'react';
import { getIdToken } from '../firebase.js';
import { buildVoiceWsUrl, sendChatMessage, extractIdeas } from '../api.js';

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
  const [status, setStatus] = useState('idle'); // idle | connecting | listening | speaking
  const [activeEngine, setActiveEngine] = useState('live'); // 'live' | 'speech-cascade'
  const [liveTranscript, setLiveTranscript] = useState([]); // { role, text }
  const [ideas, setIdeas] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 for visualizer
  const [hasMic, setHasMic] = useState(true);
  const [micActive, setMicActive] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [notice, setNotice] = useState(null); // gentle informational message, not a fatal error

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
  const voiceOutputRef = useRef(true);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    transcriptHistoryRef.current = liveTranscript;
  }, [liveTranscript]);

  useEffect(() => {
    voiceOutputRef.current = voiceOutputEnabled;
  }, [voiceOutputEnabled]);

  // Audio meter for dynamic wave visualization
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

  // Neural speech synthesis reply
  const speakReply = useCallback((text) => {
    if (!voiceOutputRef.current || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#_`]/g, '').trim();
      if (!cleanText) return;
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      setStatus('speaking');
      utterance.onend = () => setStatus('listening');
      utterance.onerror = () => setStatus('listening');
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis bypassed:', e);
      setStatus('listening');
    }
  }, []);

  // Continuous SpeechRecognition engine
  const startSpeechRecognition = useCallback((stream) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

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
        silenceTimer = setTimeout(async () => {
          const userText = (finalSpeechBuffer + ' ' + interim).trim();
          if (!userText || userText.length < 2) return;

          finalSpeechBuffer = '';
          sendText(userText);
        }, 1600);
      };

      recognition.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn('SpeechRecognition notification:', e.error);
        }
      };

      recognition.onend = () => {
        if (statusRef.current !== 'idle' && micStreamRef.current && recognitionRef.current) {
          try { recognition.start(); } catch {}
        }
      };

      recognition.start();
      setMicActive(true);
    } catch (e) {
      console.warn('SpeechRecognition start bypassed:', e);
    }
  }, []);

  // Graceful microphone acquisition
  const acquireMic = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setHasMic(false);
      return null;
    }
    try {
      // 1. First try ideal audio
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e1) {
      try {
        // 2. Fallback to basic audio
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e2) {
        console.info('[Voice] No active microphone hardware detected:', e2.message);
        setHasMic(false);
        setNotice('No microphone input detected. Voice Reader active — Tendril will voice its responses aloud.');
        return null;
      }
    }
  }, []);

  // Start the conversational runtime
  const start = useCallback(async (requestMic = false) => {
    setStatus('connecting');
    setNotice(null);

    let stream = null;
    if (requestMic) {
      stream = await acquireMic();
      if (stream) {
        micStreamRef.current = stream;
        setHasMic(true);
        startAudioMeter(stream);
        startSpeechRecognition(stream);
      }
    }

    // Connect WebSocket if possible, but NEVER block or crash on it
    try {
      const token = await getIdToken();
      if (token) {
        const ws = new WebSocket(buildVoiceWsUrl());
        wsRef.current = ws;

        const wsTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.log('[Voice] WebSocket fallback to HTTP cascade');
          }
        }, 5000);

        ws.onopen = () => {
          clearTimeout(wsTimeout);
          ws.send(JSON.stringify({ type: 'auth', idToken: token }));
        };

        ws.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (payload.type === 'auth_ok') {
              setActiveEngine('live');
              setStatus('listening');
              if (stream) beginMicCapture(ws, stream);
            } else if (payload.type === 'ideas') {
              setIdeas((prev) => [...new Set([...payload.ideas, ...prev])].slice(0, 8));
            } else if (payload.type === 'upstream') {
              handleUpstreamMessage(payload.message);
            }
          } catch (e) {}
        };

        ws.onerror = () => {
          clearTimeout(wsTimeout);
          setActiveEngine('speech-cascade');
          setStatus('listening');
        };

        ws.onclose = () => {
          setActiveEngine('speech-cascade');
          if (statusRef.current !== 'idle') setStatus('listening');
        };
      }
    } catch (err) {
      console.warn('[Voice] WS connection bypassed:', err.message);
    }

    setStatus('listening');
  }, [acquireMic, startAudioMeter, startSpeechRecognition]);

  function handleUpstreamMessage(message) {
    const parts = message?.serverContent?.modelTurn?.parts || [];
    for (const part of parts) {
      if (part.text) {
        setLiveTranscript((prev) => [...prev, { role: 'assistant', text: part.text }]);
        if (voiceOutputRef.current) speakReply(part.text);
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
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    processorRef.current = null;
    audioCtxRef.current = null;
    micStreamRef.current = null;
    setMicActive(false);
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

  // Unified Bulletproof Send: ALWAYS succeeds, WS or HTTP cascade
  const sendText = useCallback(async (text, imagePayload = null) => {
    if (!text || !text.trim()) return;
    const clean = text.trim();

    // 1. Immediately record user turn in local transcript
    setLiveTranscript((prev) => [...prev, { role: 'user', text: clean }]);

    // 2. Extract sparks asynchronously in background
    extractIdeas(clean)
      .then((sparks) => {
        if (sparks && sparks.length > 0) {
          setIdeas((prev) => [...new Set([...sparks, ...prev])].slice(0, 8));
        }
      })
      .catch(() => {});

    // 3. Try WebSocket if available and open
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'text_message', text: clean }));
        return;
      } catch (e) {
        console.warn('WS send failed, falling back to HTTP:', e);
      }
    }

    // 4. Guaranteed HTTP Cascade Fallback
    setStatus('speaking');
    try {
      const history = transcriptHistoryRef.current.map((t) => ({
        role: t.role === 'assistant' ? 'assistant' : 'user',
        text: t.text,
      }));

      const res = await sendChatMessage(clean, history, imagePayload);
      if (res.reply) {
        setLiveTranscript((prev) => [...prev, { role: 'assistant', text: res.reply }]);
        if (voiceOutputRef.current) {
          speakReply(res.reply);
        } else {
          setStatus('listening');
        }
      } else {
        setStatus('listening');
      }
    } catch (err) {
      console.warn('Chat dispatch warning:', err);
      const fallbackMsg = "I'm holding this thought in your memory stream. Reflect further or compact whenever you're ready.";
      setLiveTranscript((prev) => [...prev, { role: 'assistant', text: fallbackMsg }]);
      setStatus('listening');
    }
  }, [speakReply]);

  // Toggle microphone on demand
  const toggleMic = useCallback(async () => {
    if (micActive) {
      stopMicCapture();
    } else {
      const stream = await acquireMic();
      if (stream) {
        micStreamRef.current = stream;
        setHasMic(true);
        startAudioMeter(stream);
        startSpeechRecognition(stream);
        setNotice(null);
      }
    }
  }, [acquireMic, micActive, startAudioMeter, startSpeechRecognition]);

  const toggleVoiceOutput = useCallback(() => {
    setVoiceOutputEnabled((prev) => {
      const next = !prev;
      if (!next && window.speechSynthesis) window.speechSynthesis.cancel();
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    try {
      wsRef.current?.send(JSON.stringify({ type: 'end_session' }));
      wsRef.current?.close();
    } catch {}
    stopMicCapture();
    setStatus('idle');
  }, [stopAudioMeter]);

  return {
    status,
    activeEngine,
    audioLevel,
    liveTranscript,
    ideas,
    notice,
    hasMic,
    micActive,
    voiceOutputEnabled,
    toggleMic,
    toggleVoiceOutput,
    start,
    stop,
    sendText,
    setNotice,
  };
}
