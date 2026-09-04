import { useEffect, useRef, useState } from 'react';
import { saveEntry } from '../api.js';
import { useVoiceSession } from '../voice/useVoiceSession.js';

export default function EntryComposer({ onSaved, onExtractIdeas, initialVoiceActive = false }) {
  const {
    status,
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
    sendText,
    setNotice,
  } = useVoiceSession();

  const [draft, setDraft] = useState('');
  const [attachedImage, setAttachedImage] = useState(null); // { mimeType, data, previewUrl }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize runtime on mount
  useEffect(() => {
    start(initialVoiceActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forward real-time sparks to parent Idea Vault
  useEffect(() => {
    if (ideas && ideas.length > 0 && onExtractIdeas) {
      onExtractIdeas(ideas.map(t => typeof t === 'string' ? { type: 'spark', text: t } : t));
    }
  }, [ideas, onExtractIdeas]);

  // Auto-scroll transcript on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [liveTranscript, status]);

  function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fullBase64 = event.target.result;
      const [header, base64Data] = fullBase64.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      setAttachedImage({
        mimeType,
        data: base64Data,
        previewUrl: fullBase64,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleSend(e) {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text && !attachedImage) return;

    setError(null);
    const imageToSend = attachedImage ? { mimeType: attachedImage.mimeType, data: attachedImage.data } : null;
    const promptText = text || (attachedImage ? 'Reflect on this attached visual sketch or diagram.' : '');

    setDraft('');
    setAttachedImage(null);

    await sendText(promptText, imageToSend);
  }

  async function handleSave() {
    if (liveTranscript.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveEntry(liveTranscript);
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Could not compact and save this entry.');
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  const promptStarters = [
    '✨ Brainstorming a breakthrough feature for Tendril',
    '⚡ Analyzing bottlenecks in my current architecture',
    '🧘 Deconstructing a personal friction point today',
    '🎯 Mapping out my highest-leverage goal for this week'
  ];

  const isSynthesizing = status === 'speaking';
  const isListening = status === 'listening' && micActive;

  return (
    <div className="bezel-outer composer-canvas">
      <div className="bezel-inner" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Top Neural Toolbar */}
        <div className="composer-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: micActive ? '#10b981' : isSynthesizing ? '#38bdf8' : '#64748b',
              boxShadow: micActive ? '0 0 10px #10b981' : isSynthesizing ? '0 0 8px #38bdf8' : 'none',
              transition: 'all 0.3s ease'
            }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '14px', color: '#fff', letterSpacing: '-0.01em' }}>
              Unified Neural Canvas
            </span>
            <span style={{
              fontSize: '11px',
              color: micActive ? '#34d399' : 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              background: micActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.04)',
              padding: '2px 8px',
              borderRadius: '9999px'
            }}>
              {micActive ? '🎙️ Mic Active' : isSynthesizing ? '🔊 Voicing Reply…' : `${liveTranscript.length} exchanges`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Voice Replies Toggle */}
            <button
              type="button"
              className="btn-tendril-secondary"
              onClick={toggleVoiceOutput}
              style={{
                fontSize: '11.5px',
                padding: '5px 10px',
                color: voiceOutputEnabled ? '#34d399' : 'var(--text-muted)',
                borderColor: voiceOutputEnabled ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)',
                background: voiceOutputEnabled ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
              }}
              title={voiceOutputEnabled ? 'Voice replies enabled (click to mute)' : 'Voice replies muted (click to unmute)'}
            >
              {voiceOutputEnabled ? '🔊 Voice Replies: ON' : '🔇 Voice: Muted'}
            </button>

            {/* Save & Compact Button */}
            <button
              className="btn-tendril-primary"
              onClick={handleSave}
              disabled={liveTranscript.length === 0 || saving}
              style={{ opacity: liveTranscript.length === 0 ? 0.5 : 1, padding: '7px 14px', fontSize: '13px' }}
            >
              <span>{saving ? 'Compacting…' : 'Save & Compact'}</span>
              <div className="btn-inner-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                </svg>
              </div>
            </button>
          </div>
        </div>

        {/* Informational Notice Banner (Gentle, Not An Error) */}
        {notice && (
          <div style={{
            padding: '8px 16px',
            background: 'rgba(56, 189, 248, 0.08)',
            borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
            color: '#7dd3fc',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>💡 {notice}</span>
            <button
              onClick={() => setNotice(null)}
              style={{ background: 'transparent', border: 'none', color: '#7dd3fc', cursor: 'pointer', fontSize: '13px' }}
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 18px',
            background: 'rgba(244, 63, 94, 0.1)',
            borderBottom: '1px solid rgba(244, 63, 94, 0.25)',
            color: '#fda4af',
            fontSize: '12.5px'
          }}>
            {error}
          </div>
        )}

        {/* Message Transcript Stream */}
        <div className="transcript-stream" ref={scrollRef}>
          {liveTranscript.length === 0 && (
            <div style={{ margin: 'auto', maxWidth: '480px', textAlign: 'center', padding: '30px 10px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '16px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '22px'
              }}>
                🌱
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
                Cultivate your stream of thought
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.5', marginBottom: '24px' }}>
                Type reflections, attach visual sketches, or tap the microphone to talk aloud. Tendril retains layered context and distills sparks in real time.
              </p>

              {/* Starter chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                {promptStarters.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setDraft(prompt.replace(/^[^\s]+\s/, '')); }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {liveTranscript.map((m, i) => (
            <div key={i} className={`message-bubble-row ${m.role === 'user' ? 'user' : 'model'}`}>
              <div className="message-meta">
                <span>{m.role === 'user' ? 'YOU' : 'TENDRIL'}</span>
                <span>•</span>
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`message-bubble ${m.role === 'user' ? 'user' : 'model'}`}>
                {m.image && (
                  <div style={{ marginBottom: '10px' }}>
                    <img
                      src={m.image}
                      alt="Journal Attachment"
                      style={{ maxWidth: '240px', maxHeight: '180px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                )}
                {m.text}
              </div>
            </div>
          ))}

          {status === 'speaking' && liveTranscript[liveTranscript.length - 1]?.role === 'user' && (
            <div className="message-bubble-row model">
              <div className="message-meta">
                <span>TENDRIL</span>
                <span>•</span>
                <span>Synthesizing…</span>
              </div>
              <div className="message-bubble model" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <span className="frequency-bar" style={{ width: '4px', height: '14px', animation: 'sound-bounce 0.8s infinite alternate ease-in-out' }} />
                <span>Distilling reflection with Gemini…</span>
              </div>
            </div>
          )}
        </div>

        {/* Attached image preview banner */}
        {attachedImage && (
          <div style={{
            padding: '8px 16px',
            background: 'rgba(255, 255, 255, 0.04)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <img
              src={attachedImage.previewUrl}
              alt="Preview"
              style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.4)' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>
              Visual attachment ready for Gemini Vision
            </span>
            <button
              onClick={() => setAttachedImage(null)}
              style={{ background: 'transparent', border: 'none', color: '#fb7185', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Dynamic Frequency Bars when Mic is active */}
        {micActive && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '6px 0',
            background: 'rgba(16, 185, 129, 0.04)',
            borderTop: '1px solid rgba(16, 185, 129, 0.15)'
          }}>
            <span style={{ fontSize: '11px', color: '#34d399', fontFamily: 'var(--font-mono)', marginRight: '8px' }}>
              LISTENING
            </span>
            {[12, 22, 16, 28, 14, 24, 18, 10].map((h, idx) => (
              <span
                key={idx}
                style={{
                  width: '3px',
                  height: `${Math.max(4, Math.min(26, (audioLevel / 100) * h * 1.5))}px`,
                  background: '#10b981',
                  borderRadius: '2px',
                  transition: 'height 0.08s ease'
                }}
              />
            ))}
          </div>
        )}

        {/* Unified Multimodal Input Bar */}
        <form className="chat-input-bar" onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImagePick}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {/* Attach Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach a sketch, photo, or handwritten note (Gemini Vision)"
            style={{
              background: attachedImage ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: attachedImage ? '#10b981' : 'var(--text-secondary)'
            }}
          >
            📎
          </button>

          {/* Ambient Microphone Toggle Button */}
          <button
            type="button"
            onClick={toggleMic}
            title={micActive ? 'Mute microphone' : hasMic ? 'Activate voice conversation' : 'No mic detected — Voice Reader active'}
            style={{
              background: micActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.04)',
              border: micActive ? '1px solid rgba(16, 185, 129, 0.6)' : '1px solid var(--border-subtle)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: micActive ? '#10b981' : 'var(--text-secondary)',
              boxShadow: micActive ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </button>

          {/* Text Input Field */}
          <textarea
            className="chat-input-field"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={micActive ? "Speaking into Tendril... or type a thought" : "Type a reflection or speak via mic… (Enter to send)"}
            rows={1}
            style={{ resize: 'none', minHeight: '44px', maxHeight: '120px', flex: 1 }}
          />

          {/* Send Button */}
          <button
            type="submit"
            className="btn-tendril-primary"
            disabled={(!draft.trim() && !attachedImage) || status === 'speaking'}
            style={{ padding: '10px 14px', borderRadius: '50%', minWidth: '44px', minHeight: '44px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </div>
          </button>
        </form>

      </div>
    </div>
  );
}
