import { useEffect, useState, useRef } from 'react';
import { useVoiceSession } from '../voice/useVoiceSession.js';
import { saveEntry } from '../api.js';

export default function VoiceComposer({ onSaved, onSwitchToText, onSurfacedIdeas }) {
  const { status, activeEngine, audioLevel, liveTranscript, ideas, error, start, stop, sendText } = useVoiceSession();
  const [textDraft, setTextDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ideas && ideas.length > 0 && onSurfacedIdeas) {
      onSurfacedIdeas(ideas.map(t => ({ type: 'idea', text: t })));
    }
  }, [ideas, onSurfacedIdeas]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [liveTranscript]);

  async function handleSave() {
    if (liveTranscript.length === 0 || saving) return;
    setSaving(true);
    try {
      await saveEntry(liveTranscript);
      stop();
      onSaved?.();
    } catch (err) {
      console.error('Failed to save voice entry:', err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleTextSubmit(e) {
    e.preventDefault();
    const text = textDraft.trim();
    if (!text) return;
    sendText(text);
    setTextDraft('');
  }

  const isListening = status === 'listening' || status === 'speaking';

  return (
    <div className="bezel-outer composer-canvas">
      <div className="bezel-inner" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Voice Toolbar */}
        <div className="composer-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isListening ? '#10b981' : '#f59e0b',
              boxShadow: isListening ? '0 0 10px #10b981' : 'none'
            }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '14px', color: '#fff' }}>
              {activeEngine === 'live' ? 'Gemini Live Audio' : 'Ambient Voice Companion'}
            </span>
            <span style={{
              fontSize: '11px',
              color: isListening ? '#34d399' : 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              background: isListening ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.04)',
              padding: '2px 8px',
              borderRadius: '9999px'
            }}>
              {status === 'speaking' ? 'Tendril speaking…' : isListening ? 'Listening…' : status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="btn-tendril-secondary" onClick={onSwitchToText} style={{ fontSize: '12px', padding: '6px 14px' }}>
              ⌨️ Text Mode
            </button>
            <button
              className="btn-tendril-primary"
              onClick={handleSave}
              disabled={liveTranscript.length === 0 || saving}
              style={{ opacity: liveTranscript.length === 0 ? 0.5 : 1 }}
            >
              <span>{saving ? 'Compacting…' : 'Save & Compact'}</span>
              <div className="btn-inner-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                </svg>
              </div>
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 18px',
            background: 'rgba(245, 158, 11, 0.1)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
            color: '#fbbf24',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>🎙️ {error}</span>
            <button
              onClick={start}
              style={{ background: 'transparent', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px' }}
            >
              Retry Mic
            </button>
          </div>
        )}

        {/* Voice Visualizer Orb Header */}
        <div style={{
          padding: '24px 20px',
          background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.04) 0%, transparent 100%)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div className="voice-orb-container" style={{ width: '80px', height: '80px', marginBottom: '14px' }}>
            <div className="voice-orb-glow" style={{ transform: `scale(${1 + (audioLevel / 100) * 0.6})` }} />
            <div
              className={`voice-orb-button ${isListening ? 'active' : ''}`}
              style={{ width: '64px', height: '64px' }}
              onClick={isListening ? stop : start}
              title={isListening ? 'Click to pause' : 'Click to start voice companion'}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </div>
          </div>

          {/* Dynamic Frequency Bars based on actual audioLevel */}
          <div className="audio-frequency-bars" style={{ height: '24px', marginBottom: '8px' }}>
            {[1, 2, 3, 4, 5, 6, 7].map(i => {
              const height = isListening
                ? Math.max(6, Math.round((audioLevel / 100) * 22 * (1 + ((i * 3) % 4) * 0.25)))
                : 4;
              return (
                <span
                  key={i}
                  className="frequency-bar"
                  style={{
                    height: `${height}px`,
                    background: isListening ? '#10b981' : 'rgba(255, 255, 255, 0.2)',
                    transition: 'height 0.08s ease'
                  }}
                />
              );
            })}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {isListening ? 'Ambient microphone connected • Speak naturally or click orb to pause' : 'Microphone paused • Click orb to activate'}
          </div>
        </div>

        {/* Live Transcript Stream */}
        <div className="transcript-stream" ref={scrollRef}>
          {liveTranscript.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px', maxWidth: '380px' }}>
              Your spoken thoughts and Tendril's voice replies will stream here in real time without stopping.
            </div>
          )}

          {liveTranscript.map((m, i) => (
            <div key={i} className={`message-bubble-row ${m.role === 'user' ? 'user' : 'model'}`}>
              <div className="message-meta">
                <span>{m.role === 'user' ? 'YOU (VOICE)' : 'TENDRIL (AUDIO)'}</span>
              </div>
              <div className={`message-bubble ${m.role === 'user' ? 'user' : 'model'}`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* In-voice Text Input */}
        <form className="chat-input-bar" onSubmit={handleTextSubmit}>
          <input
            type="text"
            className="chat-input-field"
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            placeholder="Type a thought without stopping the audio stream…"
          />
          <button
            type="submit"
            className="btn-tendril-primary"
            disabled={!textDraft.trim()}
            style={{ padding: '8px 14px', borderRadius: '9999px', fontSize: '13px' }}
          >
            <span>Send</span>
          </button>
        </form>

      </div>
    </div>
  );
}
