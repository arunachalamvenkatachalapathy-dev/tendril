import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useVoiceSession } from './useVoiceSession.js';
import { saveEntry } from '../api.js';

const VoiceContext = createContext(null);

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error('useVoiceContext must be used within a VoiceProvider');
  }
  return ctx;
}

export function VoiceProvider({
  children,
  user,
  path,
  navigate,
  onSavedNote,
  onSwitchComposerMode,
}) {
  const voice = useVoiceSession();
  const [sessionId, setSessionId] = useState(
    () => 'entry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
  );
  const [savingNote, setSavingNote] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(null);

  const hasStartedRef = useRef(false);
  const hasAskedGreetingRef = useRef(false);
  const lastProcessedVoiceCommandRef = useRef('');

  // Auto-initialize voice session after login
  useEffect(() => {
    if (user && !hasStartedRef.current) {
      hasStartedRef.current = true;
      // Start voice session and attempt mic acquisition
      voice.start(true);
    }
  }, [user, voice]);

  // Initial prompt: after login and connection, prompt Gemini to ask how the user is feeling
  useEffect(() => {
    if (
      user &&
      voice.status !== 'idle' &&
      !hasAskedGreetingRef.current &&
      voice.liveTranscript.length === 0
    ) {
      // Delay slightly for audio context & websocket handshake to settle
      const t = setTimeout(() => {
        if (!hasAskedGreetingRef.current && voice.liveTranscript.length === 0) {
          hasAskedGreetingRef.current = true;
          // Send init prompt so Gemini Live proactively speaks the greeting
          voice.sendText("Hello! Greet me warmly and concisely ask how I am feeling today in one short sentence.");
        }
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [user, voice.status, voice.liveTranscript.length, voice]);

  // Explicit Save Note (Note remains open until user saves it)
  const saveCurrentNote = useCallback(async () => {
    if (voice.liveTranscript.length === 0 || savingNote) return false;
    setSavingNote(true);
    try {
      await saveEntry(voice.liveTranscript, sessionId);
      voice.clearTranscript();
      setSessionId('entry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
      setSaveSuccessNotice('Reflection note saved successfully.');
      setTimeout(() => setSaveSuccessNotice(null), 3500);
      onSavedNote?.();
      return true;
    } catch (err) {
      console.error('Failed to save reflection note:', err);
      voice.setNotice?.(err.message || 'Could not save reflection note.');
      return false;
    } finally {
      setSavingNote(false);
    }
  }, [voice, sessionId, savingNote, onSavedNote]);

  // Clear note / start new reflection draft
  const clearSession = useCallback(() => {
    voice.clearTranscript();
    setSessionId('entry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  }, [voice]);

  // Voice Navigation & Spoken Command Detection
  // Runs whenever user speech arrives
  useEffect(() => {
    const subtitle = voice.currentSubtitle;
    if (!subtitle || subtitle.role !== 'user' || !subtitle.text) return;

    const raw = subtitle.text.toLowerCase().trim().replace(/[.,!?;:]/g, '');
    if (!raw || raw === lastProcessedVoiceCommandRef.current) return;

    // Check for navigation commands
    if (/\b(move to reflect|go to reflect|open reflect|show reflect|take me to reflect|switch to reflect|reflect)\b/.test(raw)) {
      lastProcessedVoiceCommandRef.current = raw;
      if (path !== '/') navigate('/');
      return;
    }

    if (/\b(move to universe|go to universe|open universe|show universe|take me to universe|switch to universe|universe)\b/.test(raw)) {
      lastProcessedVoiceCommandRef.current = raw;
      if (path !== '/universe') navigate('/universe');
      return;
    }

    if (/\b(move to actions|go to actions|open actions|show actions|take me to actions|switch to actions|actions|dashboard)\b/.test(raw)) {
      lastProcessedVoiceCommandRef.current = raw;
      if (path !== '/dashboard') navigate('/dashboard');
      return;
    }

    // Check for save command
    if (/\b(save note|save entry|save this note|save my note)\b/.test(raw)) {
      lastProcessedVoiceCommandRef.current = raw;
      saveCurrentNote();
      return;
    }

    // Check for mode toggle commands
    if (/\b(switch to quill|switch to text|quill mode)\b/.test(raw)) {
      lastProcessedVoiceCommandRef.current = raw;
      onSwitchComposerMode?.('text');
      return;
    }

    if (/\b(switch to convo|switch to voice|convo mode)\b/.test(raw)) {
      lastProcessedVoiceCommandRef.current = raw;
      onSwitchComposerMode?.('voice');
      return;
    }
  }, [voice.currentSubtitle, path, navigate, saveCurrentNote, onSwitchComposerMode]);

  const value = {
    ...voice,
    sessionId,
    savingNote,
    saveSuccessNotice,
    saveCurrentNote,
    clearSession,
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
