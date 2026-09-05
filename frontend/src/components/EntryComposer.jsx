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
    'Reflect on what went well today',
    'Work through a challenge I am facing',
    'Brainstorm ideas for an upcoming project',
    'Clarify my key priorities for tomorrow'
  ];

  const isSynthesizing = status === 'speaking';
  const isListening = status === 'listening' && micActive;

  return (
    <div className="google-surface-card composer-canvas">
      <div className="google-card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0' }}>
        
        {/* Top Google Workspace Toolbar */}
        <div className="composer-toolbar" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: micActive ? '#6dd58c' : isSynthesizing ? '#a8c7fa' : 'var(--text-muted)',
              transition: 'all 0.3s ease'
            }} />
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#e3e3e3' }}>
              Journal Reflection
            </span>
            <span style={{
              fontSize: '11.5px',
              color: micActive ? '#a8c7fa' : 'var(--text-secondary)',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '2px 10px',
              borderRadius: '9999px',
              border: '1px solid var(--border-subtle)'
            }}>
              {micActive ? 'Listening…' : isSynthesizing ? 'Speaking…' : `${liveTranscript.length} messages`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Voice Replies Toggle */}
            <button
              type="button"
              className="btn-google-secondary"
              onClick={toggleVoiceOutput}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title={voiceOutputEnabled ? 'Voice replies active (click to mute)' : 'Voice replies muted (click to unmute)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {voiceOutputEnabled ? (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  </>
                ) : (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/>
                    <line x1="17" y1="9" x2="23" y2="15"/>
                  </>
                )}
              </svg>
              <span>{voiceOutputEnabled ? 'Voice on' : 'Voice muted'}</span>
            </button>

            {/* Save Button */}
            <button
              className="btn-google-primary"
              onClick={handleSave}
              disabled={liveTranscript.length === 0 || saving}
              style={{ opacity: liveTranscript.length === 0 ? 0.5 : 1, padding: '6px 16px', fontSize: '13px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
              </svg>
              <span>{saving ? 'Saving…' : 'Save note'}</span>
            </button>
          </div>
        </div>

        {/* Informational Notice Banner */}
        {notice && (
          <div style={{
            padding: '10px 18px',
            background: 'rgba(168, 199, 250, 0.08)',
            borderBottom: '1px solid var(--border-subtle)',
            color: '#a8c7fa',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{notice}</span>
            <button
              onClick={() => setNotice(null)}
              style={{ background: 'transparent', border: 'none', color: '#a8c7fa', cursor: 'pointer', fontSize: '13px' }}
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 18px',
            background: 'rgba(242, 139, 130, 0.12)',
            borderBottom: '1px solid rgba(242, 139, 130, 0.3)',
            color: '#f28b82',
            fontSize: '12.5px'
          }}>
            {error}
          </div>
        )}

        {/* Message Transcript Stream */}
        <div className="transcript-stream" ref={scrollRef}>
          {liveTranscript.length === 0 && (
            <div style={{ margin: 'auto', maxWidth: '480px', textAlign: 'center', padding: '36px 16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(168, 199, 250, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#a8c7fa'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#e3e3e3', marginBottom: '8px' }}>
                What is on your mind?
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.6', marginBottom: '24px' }}>
                Write your thoughts, attach an image or diagram, or tap the microphone to have a real-time conversation with Gemini.
              </p>

              {/* Starter chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                {promptStarters.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setDraft(prompt); }}
                    className="google-prompt-chip"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: '#a8c7fa', flexShrink: 0 }}>
                      <path d="M12 20h9"/>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {liveTranscript.map((m, i) => (
            <div key={i} className={`message-bubble-row ${m.role === 'user' ? 'user' : 'model'}`}>
              <div className="message-meta">
                <span>{m.role === 'user' ? 'You' : 'Tendril'}</span>
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
                <span>Tendril</span>
                <span>•</span>
                <span>Speaking…</span>
              </div>
              <div className="message-bubble model" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <span className="google-sound-bar" />
                <span className="google-sound-bar" />
                <span className="google-sound-bar" />
                <span>Thinking and reflecting…</span>
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
              style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>
              Image attached for Gemini analysis
            </span>
            <button
              onClick={() => setAttachedImage(null)}
              style={{ background: 'transparent', border: 'none', color: '#f28b82', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Google Voice Waveform Indicator */}
        {micActive && (
          <div className="google-waveform-strip">
            <span style={{ fontSize: '11.5px', color: '#a8c7fa', fontWeight: '500', marginRight: '10px' }}>
              Listening
            </span>
            {[10, 18, 14, 24, 12, 20, 16, 8].map((h, idx) => (
              <span
                key={idx}
                className="google-wave-bar"
                style={{
                  height: `${Math.max(4, Math.min(22, (audioLevel / 100) * h * 1.4))}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Multimodal Input Bar */}
        <form className="chat-input-bar" onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImagePick}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {/* Attach Button with Google Material paperclip SVG */}
          <button
            type="button"
            className="btn-google-icon"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image or diagram"
            style={{ color: attachedImage ? '#a8c7fa' : 'var(--text-secondary)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>

          {/* Microphone Toggle Button */}
          <button
            type="button"
            className={`btn-google-icon ${micActive ? 'active-mic' : ''}`}
            onClick={toggleMic}
            title={micActive ? 'Mute microphone' : hasMic ? 'Start voice conversation' : 'Microphone unavailable'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            placeholder={micActive ? "Listening… (or type a message)" : "Type a note or tap mic to speak…"}
            rows={1}
            style={{ resize: 'none', minHeight: '44px', maxHeight: '120px', flex: 1 }}
          />

          {/* Send Button */}
          <button
            type="submit"
            className="btn-google-primary"
            disabled={(!draft.trim() && !attachedImage) || status === 'speaking'}
            style={{ padding: '0', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>

      </div>
    </div>
  );
}
