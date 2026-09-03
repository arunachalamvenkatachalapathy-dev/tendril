import { useState } from 'react';

export default function IdeaStream({ ideas = [] }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  function handleCopy(text, idx) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  }

  function handleAddToCalendar(text) {
    const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&details=Distilled+action+from+Tendril+AI+Cognitive+Journal`;
    window.open(calUrl, '_blank');
  }

  return (
    <div className="bezel-outer idea-stream-col">
      <div className="bezel-inner" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Header */}
        <div className="idea-stream-header">
          <div className="panel-title">
            <span style={{ color: '#10b981' }}>⚡</span>
            <span>Idea Vault</span>
          </div>
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-dim)',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '2px 8px',
            borderRadius: '9999px'
          }}>
            {ideas.length} Distilled
          </span>
        </div>

        {/* Stream scroll area */}
        <div className="idea-cards-scroll">
          {ideas.length === 0 ? (
            <div style={{ padding: '36px 18px', textAlign: 'center', margin: 'auto' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.6 }}>💡</div>
              <div style={{ fontWeight: '600', color: '#fff', fontSize: '14px', marginBottom: '6px' }}>
                Idea Vault Awaiting Input
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', lineHeight: '1.5' }}>
                As you journal in voice or text, Tendril distills atomic sparks, actionable micro-habits, and cognitive reframings here in real time.
              </p>
            </div>
          ) : (
            ideas.map((item, idx) => {
              const itemType = (item.type || 'idea').toLowerCase();
              const isCopied = copiedIndex === idx;

              return (
                <div
                  key={idx}
                  className="idea-card"
                  style={itemType === 'reframing' ? { borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.05)' } : {}}
                >
                  <div className="idea-card-top">
                    <span className={`idea-type-pill ${itemType}`}>
                      {itemType === 'reframing' && '🌱 Cognitive Reframe'}
                      {(itemType === 'spark' || itemType === 'idea') && '💡 Spark'}
                      {itemType === 'insight' && '🔍 Insight'}
                      {itemType === 'action' && '⚡ Action'}
                      {itemType === 'question' && '❓ Query'}
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {itemType === 'action' && (
                        <button
                          className="btn-copy-mini"
                          title="Add to Google Calendar"
                          onClick={() => handleAddToCalendar(item.text)}
                          style={{ color: '#38bdf8' }}
                        >
                          📅
                        </button>
                      )}
                      <button
                        className="btn-copy-mini"
                        title="Copy to clipboard"
                        onClick={() => handleCopy(item.text, idx)}
                      >
                        {isCopied ? (
                          <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 'bold' }}>✓</span>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="idea-text">{item.text}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '11px',
          color: 'var(--text-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
            Continuously distilled by Gemini
          </div>
        </div>

      </div>
    </div>
  );
}
