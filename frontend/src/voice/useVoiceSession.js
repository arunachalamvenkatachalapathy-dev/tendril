// src/voice/useVoiceSession.js
//
// Google Gemini Live Voice Runtime:
// - Bidirectional 16kHz PCM upstream mic streaming to Gemini Live API.
// - 24kHz PCM downstream audio scheduling with seamless buffer chaining.
// - Real-time word-by-word synchronized transcripts for both user & Gemini.
// - Instant barge-in: interrupts Gemini immediately when the user speaks.
// - Resilient Web Audio lifecycle (handles autoplay restrictions, pause/resume).
// - Keepalive ping/pong and auto-reconnect on network drops.
// - Thought-filtering: eliminates model reasoning tokens from conversation bubbles.

import { useCallback, useRef, useState, useEffect } from 'react';
import { getIdToken } from '../firebase.js';
import { buildVoiceWsUrl, sendChatMessage, extractIdeas } from '../api.js';

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

function downsampleTo16k(inputBuffer, fromSampleRate) {
  if (!fromSampleRate || fromSampleRate === INPUT_SAMPLE_RATE) return inputBuffer;
  const sampleRateRatio = fromSampleRate / INPUT_SAMPLE_RATE;
  const newLength = Math.round(inputBuffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < inputBuffer.length; i++) {
      accum += inputBuffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

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
  const [liveTranscript, setLiveTranscript] = useState([]); // { role, text, isStreaming, timestamp }
  const [ideas, setIdeas] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 for visualizer
  const [hasMic, setHasMic] = useState(true);
  const [micActive, setMicActive] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [notice, setNotice] = useState(null);

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const processorRef = useRef(null);
  const micStreamRef = useRef(null);
  const playbackCtxRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);
  const recognitionRef = useRef(null);
  const animFrameRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const shouldReconnectRef = useRef(false);

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

  // Clean up all resources on unmount
  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stopAudioPlayback();
      try { wsRef.current?.close(); } catch {}
    };
  }, []);

  // Stop active scheduled audio playback immediately (instant barge-in)
  const stopAudioPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((s) => {
      try { s.stop(); } catch {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  // Audio meter for dynamic wave visualization & client-side barge-in detection
  const startAudioMeter = useCallback((stream) => {
    try {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

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
        const level = Math.min(100, Math.round(avg * 1.5));
        setAudioLevel(level);

        // Client-side instant barge-in: if user starts speaking while assistant is speaking
        if (level > 22 && statusRef.current === 'speaking') {
          stopAudioPlayback();
          setStatus('listening');
        }

        animFrameRef.current = requestAnimationFrame(checkLevel);
      };
      checkLevel();
    } catch (e) {
      console.warn('Audio meter init bypassed:', e);
    }
  }, [stopAudioPlayback]);

  const stopAudioMeter = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Neural speech synthesis reply fallback
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

  // Google Live TTS Neural Audio playback (fallback)
  const playGoogleLiveAudio = useCallback((base64Mp3, fallbackText) => {
    if (!voiceOutputRef.current) return;
    try {
      const audio = new Audio(`data:audio/mp3;base64,${base64Mp3}`);
      setStatus('speaking');
      audio.onended = () => setStatus('listening');
      audio.onerror = () => {
        if (fallbackText) speakReply(fallbackText);
        else setStatus('listening');
      };
      audio.play().catch(() => {
        if (fallbackText) speakReply(fallbackText);
        else setStatus('listening');
      });
    } catch (e) {
      if (fallbackText) speakReply(fallbackText);
      else setStatus('listening');
    }
  }, [speakReply]);

  // Seamless 24kHz PCM chunk streaming playback
  const playAudioChunk = useCallback((base64Data) => {
    if (!voiceOutputRef.current) return;
    try {
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: OUTPUT_SAMPLE_RATE,
        });
      }
      const ctx = playbackCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const arrayBuffer = base64ToArrayBuffer(base64Data);
      const pcm16 = new Int16Array(arrayBuffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

      const audioBuffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
      audioBuffer.copyToChannel(float32, 0);

      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);

      // Clamp start time against drift to prevent gaps or lag
      const now = ctx.currentTime;
      let startTime = nextStartTimeRef.current;
      if (startTime < now || startTime > now + 1.2) {
        startTime = now;
      }
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
      console.warn('Audio playback error:', err);
    }
  }, []);

  // Handles raw upstream messages from live relay
  const handleUpstreamMessage = useCallback((message) => {
    // Interruption / Barge-in signaled from server
    if (message?.serverContent?.interrupted) {
      stopAudioPlayback();
      setStatus('listening');
      setLiveTranscript((prev) =>
        prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
      );
    }

    // Play PCM audio chunks and filter thoughts
    const parts = message?.serverContent?.modelTurn?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        playAudioChunk(part.inlineData.data);
      }
      // Note: parts with thought === true are internal reasoning; never render them as spoken transcript
    }

    // Incremental output transcription (model speech)
    if (message?.serverContent?.outputTranscription?.text) {
      const text = message.serverContent.outputTranscription.text;
      setLiveTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.isStreaming) {
          return [...prev.slice(0, -1), { ...last, text: (last.text + text) }];
        }
        return [...prev, { role: 'assistant', text, isStreaming: true, timestamp: Date.now() }];
      });
    }

    // Incremental input transcription (user speech recognized by Gemini Live)
    if (message?.serverContent?.inputTranscription?.text) {
      const text = message.serverContent.inputTranscription.text;
      setLiveTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'user' && (last.isStreaming || last.isInterim)) {
          return [...prev.slice(0, -1), { role: 'user', text: (last.isInterim ? text : last.text + text), isStreaming: true, isInterim: false }];
        }
        return [...prev, { role: 'user', text, isStreaming: true, isInterim: false, timestamp: Date.now() }];
      });
    }

    // Turn complete: finalize streaming message
    if (message?.serverContent?.turnComplete) {
      setLiveTranscript((prev) =>
        prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
      );
    }
  }, [playAudioChunk, stopAudioPlayback]);

  // Handle explicit normalized transcription deltas from backend relay
  const handleTranscriptionDelta = useCallback((role, text) => {
    setLiveTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && last.isStreaming) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { role, text, isStreaming: true, timestamp: Date.now() }];
    });
  }, []);

  // Begins microphone PCM capture (16kHz mono) and streams frames to WebSocket
  const beginMicCapture = useCallback((ws, stream) => {
    try {
      if (processorRef.current) {
        try { processorRef.current.disconnect(); } catch {}
        processorRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close(); } catch {}
        audioCtxRef.current = null;
      }

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Mute local microphone playback to prevent speaker loopback / screech
      const muteNode = audioCtx.createGain();
      muteNode.gain.value = 0;

      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const resampled = downsampleTo16k(input, audioCtx.sampleRate);
        const pcm = floatTo16BitPCM(resampled);
        ws.send(JSON.stringify({ type: 'audio_chunk', data: bufferToBase64(pcm) }));
      };

      source.connect(processor);
      processor.connect(muteNode);
      muteNode.connect(audioCtx.destination);
    } catch (e) {
      console.warn('PCM capture setup:', e);
    }
  }, []);

  const stopMicCapture = useCallback(() => {
    stopAudioMeter();
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
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
  }, [stopAudioMeter, stopAudioPlayback]);

  // Connects or re-connects the live WebSocket relay to Cloud Run
  const connectWs = useCallback(async (onReady) => {
    try {
      const token = await getIdToken();
      if (!token) return null;

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (onReady) onReady(wsRef.current);
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

      const wsTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.log('[Voice] WebSocket fallback to speech-cascade');
          setActiveEngine('speech-cascade');
          setStatus('listening');
        }
      }, 8000);

      ws.onopen = () => {
        clearTimeout(wsTimeout);
        ws.send(JSON.stringify({ type: 'auth', idToken: token }));

        // Start ping keepalive every 20 seconds
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
          }
        }, 20000);
      };

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload.type === 'auth_ok') {
            setActiveEngine('live');
            setStatus('listening');
            if (onReady) {
              onReady(ws);
            } else if (micStreamRef.current) {
              beginMicCapture(ws, micStreamRef.current);
            }
          } else if (payload.type === 'pong') {
            // Heartbeat acknowledged
          } else if (payload.type === 'transcription') {
            handleTranscriptionDelta(payload.role, payload.text);
          } else if (payload.type === 'interrupted') {
            stopAudioPlayback();
            setStatus('listening');
            setLiveTranscript((prev) =>
              prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
            );
          } else if (payload.type === 'turn_complete') {
            setLiveTranscript((prev) =>
              prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
            );
          } else if (payload.type === 'ideas') {
            setIdeas((prev) => [...new Set([...payload.ideas, ...prev])].slice(0, 8));
          } else if (payload.type === 'upstream') {
            handleUpstreamMessage(payload.message);
          } else if (payload.type === 'error') {
            console.warn('[Voice WS] Relay error:', payload.error);
            setActiveEngine('speech-cascade');
          }
        } catch (e) {}
      };

      ws.onerror = (e) => {
        clearTimeout(wsTimeout);
        console.warn('[Voice WS] Error:', e);
        setActiveEngine('speech-cascade');
        setStatus('listening');
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (shouldReconnectRef.current && statusRef.current !== 'idle') {
          reconnectTimerRef.current = setTimeout(() => {
            if (shouldReconnectRef.current) connectWs(onReady);
          }, 2000);
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
  }, [beginMicCapture, handleTranscriptionDelta, handleUpstreamMessage, stopAudioPlayback]);

  // Unified Bulletproof Send: ALWAYS succeeds, WS or HTTP cascade
  const sendText = useCallback(async (text, imagePayload = null) => {
    if (!text || !text.trim()) return;
    const clean = text.trim();

    // 1. Immediately record user turn in local transcript
    setLiveTranscript((prev) => [...prev, { role: 'user', text: clean, timestamp: Date.now() }]);

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

      const res = await sendChatMessage(clean, history, imagePayload, voiceOutputRef.current);
      if (res.reply) {
        setLiveTranscript((prev) => [...prev, { role: 'assistant', text: res.reply, timestamp: Date.now() }]);
        if (voiceOutputRef.current) {
          if (res.audioContent) {
            playGoogleLiveAudio(res.audioContent, res.reply);
          } else {
            speakReply(res.reply);
          }
        } else {
          setStatus('listening');
        }
      } else {
        setStatus('listening');
      }
    } catch (err) {
      console.warn('Chat dispatch warning:', err);
      const fallbackMsg = "I'm holding this thought in your memory stream. Reflect further or compact whenever you're ready.";
      setLiveTranscript((prev) => [...prev, { role: 'assistant', text: fallbackMsg, timestamp: Date.now() }]);
      setStatus('listening');
    }
  }, [playGoogleLiveAudio, speakReply]);

  // SpeechRecognition engine for real-time interim user preview on browsers that support it
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

        const userSpoken = (finalSpeechBuffer + ' ' + interim).trim();
        if (userSpoken) {
          // Instant barge-in if user spoke while assistant was speaking
          if (statusRef.current === 'speaking') {
            stopAudioPlayback();
            setStatus('listening');
          }

          // Preview speech dynamically in user chat bubble if not already streaming from Gemini Live
          setLiveTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'user' && (last.isInterim || last.isStreaming)) {
              return [...prev.slice(0, -1), { role: 'user', text: userSpoken, isInterim: true }];
            }
            return [...prev, { role: 'user', text: userSpoken, isInterim: true }];
          });
        }

        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(async () => {
          const userText = (finalSpeechBuffer + ' ' + interim).trim();
          if (!userText || userText.length < 2) return;

          finalSpeechBuffer = '';
          setLiveTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'user' && last.isInterim) {
              return [...prev.slice(0, -1), { role: 'user', text: userText, isInterim: false }];
            }
            return [...prev, { role: 'user', text: userText, isInterim: false }];
          });

          // Only send as text message if WebSocket is not actively streaming PCM audio
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            sendText(userText);
          }
        }, 1200);
      };

      recognition.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn('SpeechRecognition notice:', e.error);
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
  }, [sendText, stopAudioPlayback]);

  // Graceful microphone acquisition
  const acquireMic = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setHasMic(false);
      return null;
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e1) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e2) {
        console.info('[Voice] No active microphone hardware detected:', e2.message);
        setHasMic(false);
        setNotice('No microphone detected. Voice Reader active — Tendril will voice its responses aloud.');
        return null;
      }
    }
  }, []);

  // Start the conversational runtime
  const start = useCallback(async (requestMic = false) => {
    setNotice(null);
    shouldReconnectRef.current = true;

    // Resume playback context on user gesture
    if (playbackCtxRef.current && playbackCtxRef.current.state === 'suspended') {
      playbackCtxRef.current.resume().catch(() => {});
    }

    let stream = null;
    if (requestMic) {
      stream = await acquireMic();
      if (stream) {
        micStreamRef.current = stream;
        setHasMic(true);
        setMicActive(true);
        startAudioMeter(stream);
        startSpeechRecognition(stream);
      }
    }

    connectWs((ws) => {
      if (stream) {
        beginMicCapture(ws, stream);
      }
    });

    setStatus('listening');
  }, [acquireMic, beginMicCapture, connectWs, startAudioMeter, startSpeechRecognition]);

  // Toggle microphone on demand
  const toggleMic = useCallback(async () => {
    if (micActive) {
      stopMicCapture();
    } else {
      // Resume Web Audio playback context on user gesture
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: OUTPUT_SAMPLE_RATE,
        });
      }
      if (playbackCtxRef.current && playbackCtxRef.current.state === 'suspended') {
        playbackCtxRef.current.resume().catch(() => {});
      }

      const stream = await acquireMic();
      if (stream) {
        micStreamRef.current = stream;
        setHasMic(true);
        setMicActive(true);
        startAudioMeter(stream);
        startSpeechRecognition(stream);
        setNotice(null);

        // Connect or use active WebSocket to stream mic to Gemini Live API
        connectWs((ws) => {
          beginMicCapture(ws, stream);
        });
      }
    }
  }, [acquireMic, beginMicCapture, connectWs, micActive, startAudioMeter, startSpeechRecognition, stopMicCapture]);

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
    setStatus('idle');
  }, [stopAudioPlayback, stopMicCapture]);

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
