import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
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

  // Auto-initialize voice session after login safely without blocking getUserMedia
  useEffect(() => {
    if (user && !hasStartedRef.current) {
      hasStartedRef.current = true;
      try {
        voice.start(false); // Connect live session in background
      } catch (e) {
        console.warn('[VoiceContext] start error:', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

    // Check for save command (immediate voice save)
    const isSaveCommand =
      /\b(save( (my|the|this|his|her|our)? *(chat|convo|conversation|reflection|entry|note|session|everything))?|save it|save this|save now|please save)\b/i.test(raw) ||
      raw.includes('save his chat') ||
      raw.includes('save my chat') ||
      raw.includes('save chat') ||
      raw.includes('save the chat') ||
      raw.includes('save this chat') ||
      raw.includes('save conversation') ||
      raw.includes('save this conversation') ||
      raw.includes('save this') ||
      raw === 'save';

    if (isSaveCommand) {
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

  const value = useMemo(
    () => ({
      ...voice,
      sessionId,
      savingNote,
      saveSuccessNotice,
      saveCurrentNote,
      clearSession,
    }),
    [voice, sessionId, savingNote, saveSuccessNotice, saveCurrentNote, clearSession]
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
