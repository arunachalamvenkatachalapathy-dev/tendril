import { useEffect, useRef, useState } from 'react';
import { sendChatMessage, saveEntry } from '../api.js';

export default function EntryComposer({ onSaved, onExtractIdeas }) {
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', text }
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function handleSend(e) {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || sending) return;

    setError(null);
    const nextMessages = [...messages, { role: 'user', text }];
    setMessages(nextMessages);
    setDraft('');
    setSending(true);

    try {
      const { reply } = await sendChatMessage(text, messages);
      setMessages([...nextMessages, { role: 'assistant', text: reply }]);
      // extract ideas in background
      if (onExtractIdeas) {
        onExtractIdeas([...nextMessages, { role: 'assistant', text: reply }]);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleSave() {
    if (messages.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveEntry(messages);
      setMessages([]);
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Could not save this entry.');
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

  return (
    <div className="bezel-outer composer-canvas">
      <div className="bezel-inner" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Top Action Toolbar */}
        <div className="composer-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '14px', color: '#fff', letterSpacing: '-0.01em' }}>
              Cognitive Session
            </span>
            <span style={{
              fontSize: '11px',
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '2px 8px',
              borderRadius: '9999px'
            }}>
              {messages.length} exchanges
            </span>
          </div>

          <button
            className="btn-tendril-primary"
            onClick={handleSave}
            disabled={messages.length === 0 || saving}
            style={{ opacity: messages.length === 0 ? 0.5 : 1 }}
          >
            <span>{saving ? 'Compacting & Saving…' : 'Save & Compact'}</span>
            <div className="btn-inner-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
            </div>
          </button>
        </div>

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

        {/* Message Stream */}
        <div className="transcript-stream" ref={scrollRef}>
          {messages.length === 0 && (
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
                Unpack ideas, talk through strategic decisions, or reflect. Tendril remembers recent context
                and distills action points in real time.
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

          {messages.map((m, i) => (
            <div key={i} className={`message-bubble-row ${m.role === 'user' ? 'user' : 'model'}`}>
              <div className="message-meta">
                <span>{m.role === 'user' ? 'YOU' : 'TENDRIL'}</span>
                <span>•</span>
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`message-bubble ${m.role === 'user' ? 'user' : 'model'}`}>
                {m.text}
              </div>
            </div>
          ))}

          {sending && (
            <div className="message-bubble-row model">
              <div className="message-meta">
                <span>TENDRIL</span>
                <span>•</span>
                <span>Synthesizing…</span>
              </div>
              <div className="message-bubble model" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <span className="frequency-bar" style={{ width: '4px', height: '14px', animation: 'sound-bounce 0.8s infinite alternate ease-in-out' }} />
                <span>Distilling thoughts with Gemini…</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form className="chat-input-bar" onSubmit={handleSend}>
          <textarea
            className="chat-input-field"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Explore an idea… (Press Enter to send, Shift+Enter for newline)"
            rows={1}
            style={{ resize: 'none', minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            className="btn-tendril-primary"
            disabled={!draft.trim() || sending}
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
