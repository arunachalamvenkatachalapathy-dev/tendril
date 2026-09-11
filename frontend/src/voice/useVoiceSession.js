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
    // Buffer ~100ms of audio according to the AudioWorklet sampleRate
    this.bufferSize = Math.round((typeof sampleRate !== 'undefined' ? sampleRate : 48000) * 0.1);
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
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('tendril_voice_lang') || 'en';
    } catch {
      return 'en';
    }
  });

  const languageRef = useRef('en');
  useEffect(() => {
    languageRef.current = language;
    try {
      localStorage.setItem('tendril_voice_lang', language);
    } catch {}
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'set_language', language }));
      } catch {}
    }
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === 'en' ? 'multi' : 'en'));
  }, []);

  const micActiveRef = useRef(false);
  useEffect(() => { micActiveRef.current = micActive; }, [micActive]);

  const activeEngineRef = useRef('live');
  useEffect(() => { activeEngineRef.current = activeEngine; }, [activeEngine]);

  // WebSocket + audio refs
  const wsRef = useRef(null);
  const playbackCtxRef = useRef(null);
  const playbackGainNodeRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);
  const isPlaybackActiveRef = useRef(false);
  const playbackEndTimerRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const audioLevelTimerRef = useRef(null);
  const audioLevelRef = useRef(0);
  const hasSpokenInTurnRef = useRef(false);
  const lastSpeechTimeRef = useRef(0);
  const analyserRef = useRef(null);
  const analyserCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const recognitionRef = useRef(null);
  const startSpeechRecognitionRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(false);
  const onReadyCallbackRef = useRef(null);
  const connectingPromiseRef = useRef(null);

  const transcriptHistoryRef = useRef([]);
  const statusRef = useRef('idle');
  const voiceOutputRef = useRef(true);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { transcriptHistoryRef.current = liveTranscript; }, [liveTranscript]);
  useEffect(() => { voiceOutputRef.current = voiceOutputEnabled; }, [voiceOutputEnabled]);

  // ─────────────────────────────────────────────────────────────────────────────
  // AUDIO PLAYBACK HELPERS (24kHz PCM from Gemini Live)
  // ─────────────────────────────────────────────────────────────────────────────

  const ensurePlaybackContext = useCallback(() => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      // Do not force sampleRate: 24000; native hardware rate prevents NotSupportedError on iOS/Android
      const ctx = new AudioCtx({ latencyHint: 'interactive' });
      playbackCtxRef.current = ctx;

      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      gain.connect(ctx.destination);
      playbackGainNodeRef.current = gain;
    }
    const ctx = playbackCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }, []);

  const stopAudioPlayback = useCallback(() => {
    if (playbackEndTimerRef.current) {
      clearTimeout(playbackEndTimerRef.current);
      playbackEndTimerRef.current = null;
    }
    isPlaybackActiveRef.current = false;
    // 1. Immediately cancel any scheduled Web Speech API synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }

    // 2. Immediately stop, disconnect, and purge all queued buffer sources
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
        s.disconnect();
      } catch {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;

    // 3. Reset gain node for next turn
    const ctx = playbackCtxRef.current;
    const gainNode = playbackGainNodeRef.current;
    if (ctx && gainNode && ctx.state === 'running') {
      try {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(1.0, now);
      } catch {}
    }
  }, []);

  // Ambient Music Ducking & Independent Audio Control for Convo Mode:
  // - When the user is speaking: Music drops to 0% (complete silence for clear mic capture).
  //   Also, any active assistant audio playback immediately cuts to 0 ("when I'm speaking the volume of the convo should move to zero").
  // - When assistant/convo relays/replies: Music ducks to 5% (soft ambient background).
  // - When idle: Music returns to user's independent volume setting (ducking never permanently alters volume).
  useEffect(() => {
    const isUserSpeaking = micActive && (audioLevel > 12 || (currentSubtitle?.role === 'user' && currentSubtitle?.isLive));
    const isAssistantSpeaking = status === 'speaking' || (currentSubtitle?.role === 'assistant' && currentSubtitle?.isLive);
    const isSpeaking = isUserSpeaking || isAssistantSpeaking;

    let timer = null;

    if (isSpeaking) {
      window.dispatchEvent(new CustomEvent('tendril:voice-speaking', {
        detail: {
          isSpeaking: true,
          userSpeaking: isUserSpeaking,
          assistantSpeaking: isAssistantSpeaking,
        }
      }));
    } else {
      timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tendril:voice-speaking', {
          detail: {
            isSpeaking: false,
            userSpeaking: false,
            assistantSpeaking: false,
          }
        }));
      }, 700);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status, micActive, audioLevel, currentSubtitle, stopAudioPlayback]);

  // Ensure ducking is immediately released if unmounting
  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('tendril:voice-speaking', {
        detail: { isSpeaking: false, userSpeaking: false, assistantSpeaking: false }
      }));
    };
  }, []);

  const playAudioChunk = useCallback((base64Data) => {
    if (!voiceOutputRef.current) return;
    try {
      // Clear any pending end-of-turn timer because a new chunk has arrived
      if (playbackEndTimerRef.current) {
        clearTimeout(playbackEndTimerRef.current);
        playbackEndTimerRef.current = null;
      }

      // Ensure browser speech synthesis never collides with Gemini Live PCM audio
      if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
        window.speechSynthesis.cancel();
      }
      const ctx = ensurePlaybackContext();
      const gainNode = playbackGainNodeRef.current;
      const arrayBuffer = base64ToArrayBuffer(base64Data);
      if (!arrayBuffer || arrayBuffer.byteLength < 2) return;

      const safeLength = arrayBuffer.byteLength - (arrayBuffer.byteLength % 2);
      if (safeLength === 0) return;

      const pcm16 = new Int16Array(arrayBuffer.slice(0, safeLength));
      if (pcm16.length === 0) return;

      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

      // Mark playback active so mic does not echo Gemini's own words back into the model
      isPlaybackActiveRef.current = true;
      if (statusRef.current !== 'speaking') {
        setStatus('speaking');
      }

      // Web Audio natively resamples 24kHz buffer to hardware context rate
      const audioBuffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
      audioBuffer.copyToChannel(float32, 0);

      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      if (gainNode) {
        src.connect(gainNode);
      } else {
        src.connect(ctx.destination);
      }

      const now = ctx.currentTime;
      // If nextStartTime is in the past (idle or gap after silence),
      // schedule smoothly starting with a tiny 40ms lead for network jitter absorption.
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + 0.04;
      }
      const startTime = nextStartTimeRef.current;
      src.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(src);
      src.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== src);
        if (activeSourcesRef.current.length === 0) {
          // Acoustic echo decay & streaming jitter grace window (400ms):
          // Do not instantly release isPlaybackActive or reset nextStartTime to prevent
          // false barge-in interrupts from speaker reverberation or packet jitter.
          if (playbackEndTimerRef.current) clearTimeout(playbackEndTimerRef.current);
          playbackEndTimerRef.current = setTimeout(() => {
            if (activeSourcesRef.current.length === 0) {
              isPlaybackActiveRef.current = false;
              nextStartTimeRef.current = 0;
              if (statusRef.current === 'speaking') {
                setStatus('listening');
              }
            }
          }, 400);
        }
      };
    } catch (err) {
      console.warn('[Voice] Audio playback error:', err.message);
    }
  }, [ensurePlaybackContext]);

  const speakReply = useCallback((text) => {
    if (!voiceOutputRef.current || !window.speechSynthesis) return;
    if (activeEngineRef.current === 'live') return; // Live PCM stream handles speech in live mode
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#_`]/g, '').trim();
      if (!cleanText) return;
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select highest quality natural / neural voice
      const voices = window.speechSynthesis.getVoices();
      const isMulti = languageRef.current === 'multi';
      let selectedVoice = null;
      if (!isMulti) {
        selectedVoice = voices.find((v) =>
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural') || v.name.includes('Premium')) &&
          v.lang.startsWith('en')
        ) || voices.find((v) => v.lang.startsWith('en'));
      } else {
        const userLang = navigator.language || 'en-US';
        selectedVoice = voices.find((v) => v.lang.startsWith(userLang.slice(0, 2))) ||
          voices.find((v) => v.name.includes('Natural') && v.lang.startsWith('en')) ||
          voices[0];
      }
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

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
    if (activeEngineRef.current === 'live') return; // Live PCM stream handles speech in live mode
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

      // Reuse shared playback AudioContext to preserve single-graph AEC on mobile
      const ctx = ensurePlaybackContext();
      analyserCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      // NOTE: Analyser is deliberately NOT connected to ctx.destination to avoid feedback
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const level = Math.min(100, Math.round(avg * 1.5));
        audioLevelRef.current = level;
        setAudioLevel(level);

        // Turn completion: when user was speaking (> 10) and then pauses (> 650ms),
        // send audio_stream_end so Gemini Live immediately finalizes and answers!
        if (level > 10) {
          hasSpokenInTurnRef.current = true;
          lastSpeechTimeRef.current = Date.now();
        } else if (hasSpokenInTurnRef.current && (Date.now() - lastSpeechTimeRef.current > 650)) {
          hasSpokenInTurnRef.current = false;
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isPlaybackActiveRef.current) {
            try {
              wsRef.current.send(JSON.stringify({ type: 'audio_stream_end' }));
            } catch {}
          }
        }

        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn('[Voice] Audio meter unavailable:', e.message);
    }
  }, [ensurePlaybackContext]);

  const stopAudioMeter = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    analyserRef.current = null;
    analyserCtxRef.current = null;
    audioLevelRef.current = 0;
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
  }, []);

  const beginMicCapture = useCallback(async (ws, stream) => {
    stopMicCaptureOnly();

    try {
      // Reuse the shared AudioContext from ensurePlaybackContext to guarantee
      // a single unified audio graph on mobile browsers (prevents HAL collisions)
      const audioCtx = ensurePlaybackContext();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const sampleRate = audioCtx.sampleRate;

      const sendPcmChunk = (float32Chunk) => {
        const activeWs = wsRef.current || ws;
        if (!activeWs || activeWs.readyState !== WebSocket.OPEN) return;

        // When assistant is actively speaking, only gate if mic is quiet (level < 8) to avoid speaker echo.
        // User speech (level >= 8) is transmitted cleanly.
        if (isPlaybackActiveRef.current && audioLevelRef.current < 8) {
          return;
        }

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

          // Connect to destination via mute gain so Chrome/Safari audio thread continuously pulls samples
          const workletMuteGain = audioCtx.createGain();
          workletMuteGain.gain.value = 0;
          workletNode.connect(workletMuteGain);
          workletMuteGain.connect(audioCtx.destination);

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
        // Route through a gain=0 node so browser processes the audio without echoing to speakers
        const muteGain = audioCtx.createGain();
        muteGain.gain.value = 0;
        source.connect(processor);
        processor.connect(muteGain);
        muteGain.connect(audioCtx.destination);
        console.log('[Voice] ScriptProcessor PCM capture running (rate=%d, muted monitor)', sampleRate);
      }
    } catch (e) {
      console.warn('[Voice] Mic capture setup error:', e.message);
    }
  }, [stopMicCaptureOnly]);

  const stopMicCapture = useCallback(() => {
    stopAudioMeter();
    stopMicCaptureOnly();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'audio_stream_end' }));
      } catch {}
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    // Freeze current user subtitle as finished speaking instead of clearing it,
    // and DO NOT cut off Gemini's voice playback!
    setCurrentSubtitle((prev) => (prev ? { ...prev, isLive: false } : null));
    setMicActive(false);
  }, [stopAudioMeter, stopMicCaptureOnly]);

  // ─────────────────────────────────────────────────────────────────────────────
  // WEBSOCKET RELAY CONNECTION
  // ─────────────────────────────────────────────────────────────────────────────

  const connectWs = useCallback(async (onReady) => {
    if (onReady) onReadyCallbackRef.current = onReady;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (onReadyCallbackRef.current) {
        const cb = onReadyCallbackRef.current;
        onReadyCallbackRef.current = null;
        cb(wsRef.current);
      }
      return wsRef.current;
    }

    if (connectingPromiseRef.current) {
      return connectingPromiseRef.current;
    }

    const connectTask = (async () => {
      try {
        const token = await getIdToken();
        if (!token) return null;

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          if (onReadyCallbackRef.current) {
            const cb = onReadyCallbackRef.current;
            onReadyCallbackRef.current = null;
            cb(wsRef.current);
          }
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
          connectingPromiseRef.current = null;
          reconnectAttemptsRef.current = 0;
          ws.send(JSON.stringify({ type: 'auth', idToken: token, language: languageRef.current }));

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
                if (recognitionRef.current) {
                  try { recognitionRef.current.stop(); } catch {}
                  recognitionRef.current = null;
                }
                if (onReadyCallbackRef.current) {
                  const cb = onReadyCallbackRef.current;
                  onReadyCallbackRef.current = null;
                  cb(ws);
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
                // Only abort queued assistant audio if user is deliberately speaking loudly into the mic (> 26)
                // If user is not loudly speaking, let already queued speech finish completely without cutoff!
                if (audioLevelRef.current > 26) {
                  stopAudioPlayback();
                  setStatus('listening');
                  setCurrentSubtitle(null);
                }
                setLiveTranscript((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
                break;
              case 'turn_complete':
                setCurrentSubtitle((prev) => prev ? { ...prev, isLive: false } : null);
                setLiveTranscript((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
                if (activeSourcesRef.current.length === 0) {
                  if (playbackEndTimerRef.current) clearTimeout(playbackEndTimerRef.current);
                  playbackEndTimerRef.current = setTimeout(() => {
                    if (activeSourcesRef.current.length === 0) {
                      isPlaybackActiveRef.current = false;
                      nextStartTimeRef.current = 0;
                      if (statusRef.current === 'speaking') {
                        setStatus('listening');
                      }
                    }
                  }, 300);
                }
                break;
              case 'ideas':
                setIdeas((prev) => [...new Set([...payload.ideas, ...prev])].slice(0, 8));
                break;
              case 'error':
                console.warn('[Voice WS] Relay error:', payload.error);
                setActiveEngine('speech-cascade');
                if (micStreamRef.current && micActiveRef.current) {
                  startSpeechRecognitionRef.current?.(micStreamRef.current);
                }
                break;
              default:
                break;
            }
          } catch (e) {}
        };

        ws.onerror = () => {
          clearTimeout(wsTimeout);
          connectingPromiseRef.current = null;
          console.warn('[Voice WS] Connection error — switching to speech-cascade');
          setActiveEngine('speech-cascade');
          setStatus('listening');
          if (micStreamRef.current && micActiveRef.current) {
            startSpeechRecognitionRef.current?.(micStreamRef.current);
          }
        };

        ws.onclose = (event) => {
          connectingPromiseRef.current = null;
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          // Code 1000 = normal/intended close (superseded, component unmount, user stop).
          // Code 1001 = going away. Never reconnect on these — that would open a 3rd session
          // while the backend already has a newer one active, causing two voices to speak.
          const isAbnormal = event.code !== 1000 && event.code !== 1001;
          if (isAbnormal && shouldReconnectRef.current && statusRef.current !== 'idle' && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            console.warn('[Voice] WS closed abnormally (code=%d), reconnecting…', event.code);
            const delay = Math.min(8000, 1500 * Math.pow(2, reconnectAttemptsRef.current));
            reconnectAttemptsRef.current += 1;
            reconnectTimerRef.current = setTimeout(() => {
              if (shouldReconnectRef.current) connectWs(onReady);
            }, delay);
          } else {
            if (!isAbnormal) {
              console.log('[Voice] WS closed normally (code=%d), not reconnecting', event.code);
            }
            setActiveEngine('speech-cascade');
            if (statusRef.current !== 'idle') {
              setStatus('listening');
              if (micStreamRef.current && micActiveRef.current) {
                startSpeechRecognitionRef.current?.(micStreamRef.current);
              }
            }
          }
        };

        return ws;
      } catch (err) {
        connectingPromiseRef.current = null;
        console.warn('[Voice] WS connect exception:', err.message);
        setActiveEngine('speech-cascade');
        return null;
      }
    })();

    connectingPromiseRef.current = connectTask;
    return connectTask;
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
        wsRef.current.send(JSON.stringify({ type: 'text_message', text: clean, language: languageRef.current }));
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
      const res = await sendChatMessage(clean, history, imagePayload, voiceOutputRef.current, languageRef.current);
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
    // Only run SpeechRecognition in speech-cascade fallback mode.
    // In live mode, Gemini Live native ASR provides accurate real-time transcription.
    if (activeEngineRef.current === 'live') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = languageRef.current === 'multi' ? (navigator.language || 'en-US') : 'en-US';
      recognition.maxAlternatives = 1;

      let silenceTimer = null;
      let finalSpeechBuffer = '';

      recognition.onresult = (event) => {
        if (statusRef.current === 'speaking' || activeEngineRef.current === 'live') {
          return;
        }

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
          setCurrentSubtitle({ role: 'user', text: userSpoken, isLive: true });
          setLiveTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'user' && last.isStreaming) {
              return [...prev.slice(0, -1), { ...last, text: userSpoken }];
            }
            return [...prev, { role: 'user', text: userSpoken, isStreaming: true, timestamp: Date.now() }];
          });
        }

        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          const userText = (finalSpeechBuffer + ' ' + interim).trim();
          if (!userText || userText.length < 2) return;
          finalSpeechBuffer = '';
          if (activeEngineRef.current !== 'live') {
            sendText(userText);
          }
        }, 1100);
      };

      recognition.onend = () => {
        if (micActiveRef.current && activeEngineRef.current !== 'live') {
          setTimeout(() => {
            if (micActiveRef.current && recognitionRef.current === recognition) {
              try { recognition.start(); } catch {}
            }
          }, 300);
        }
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
  }, [sendText]);

  useEffect(() => {
    startSpeechRecognitionRef.current = startSpeechRecognition;
  }, [startSpeechRecognition]);

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
    shouldReconnectRef.current = true;
    startAudioMeter(stream);

    // Connect WebSocket and begin capture once auth_ok is received
    connectWs((ws) => {
      beginMicCapture(ws, stream);
    });

    // Start real-time speech recognition ONLY when in speech-cascade fallback mode
    if (activeEngineRef.current !== 'live') {
      startSpeechRecognition(stream);
    }
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

  const start = useCallback(async (requestMic = false) => {
    setNotice(null);
    shouldReconnectRef.current = true;
    setStatus('listening');
    if (requestMic) {
      toggleMic();
    } else {
      connectWs();
    }
  }, [connectWs, toggleMic]);

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
      wsRef.current?.send(JSON.stringify({ type: 'audio_stream_end' }));
      wsRef.current?.send(JSON.stringify({ type: 'end_session' }));
      wsRef.current?.close();
    } catch {}
    stopMicCapture();
    stopAudioPlayback();
    setCurrentSubtitle(null);
    setStatus('idle');
  }, [stopAudioPlayback, stopMicCapture]);

  // Teardown everything on unmount
  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;
      connectingPromiseRef.current = null;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioLevelTimerRef.current) clearInterval(audioLevelTimerRef.current);
      try {
        wsRef.current?.send(JSON.stringify({ type: 'audio_stream_end' }));
        wsRef.current?.send(JSON.stringify({ type: 'end_session' }));
        wsRef.current?.close(1000, 'Component unmounted');
      } catch {}
      wsRef.current = null;
      stopMicCapture();
      stopAudioPlayback();
    };
  }, [stopAudioPlayback, stopMicCapture]);

  const clearTranscript = useCallback(() => {
    setLiveTranscript([]);
    transcriptHistoryRef.current = [];
    setCurrentSubtitle(null);
  }, []);

  return {
    status,
    activeEngine,
    audioLevel,
    liveTranscript,
    setLiveTranscript,
    clearTranscript,
    currentSubtitle,
    ideas,
    notice,
    hasMic,
    micActive,
    voiceOutputEnabled,
    language,
    setLanguage,
    toggleLanguage,
    toggleMic,
    toggleVoiceOutput,
    stopAudioPlayback,
    start,
    stop,
    sendText,
    setNotice,
  };
}
