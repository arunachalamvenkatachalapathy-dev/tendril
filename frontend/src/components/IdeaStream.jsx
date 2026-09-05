import { useState } from 'react';

export default function IdeaStream({ ideas = [] }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  function handleCopy(text, idx) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  }

  function handleAddToCalendar(text) {
    const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&details=Action+item+from+Tendril+Journal`;
    window.open(calUrl, '_blank');
  }

  return (
    <div className="google-surface-card idea-stream-col">
      <div className="google-card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0' }}>
        
        {/* Header */}
        <div className="idea-stream-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '15px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa' }}>
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z" />
            </svg>
            <span>Insights</span>
          </div>
          <span style={{
            fontSize: '11.5px',
            color: 'var(--text-secondary)',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '2px 10px',
            borderRadius: '9999px',
            border: '1px solid var(--border-subtle)'
          }}>
            {ideas.length} extracted
          </span>
        </div>

        {/* Stream scroll area */}
        <div className="idea-cards-scroll">
          {ideas.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', margin: 'auto' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a8c7fa' }}>
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
                </svg>
              </div>
              <div style={{ fontWeight: '500', color: '#e3e3e3', fontSize: '14px', marginBottom: '6px' }}>
                No insights yet
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', maxWidth: '260px', margin: '0 auto' }}>
                Key takeaways, action items, and reflection points will appear here in real time as you journal.
              </p>
            </div>
          ) : (
            ideas.map((item, idx) => {
              const itemType = (item.type || 'idea').toLowerCase();
              const isCopied = copiedIndex === idx;

              return (
                <div
                  key={idx}
                  className="google-insight-card"
                >
                  <div className="idea-card-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className={`google-type-pill ${itemType}`}>
                      {itemType === 'reframing' && 'Reframe'}
                      {(itemType === 'spark' || itemType === 'idea') && 'Idea'}
                      {itemType === 'insight' && 'Insight'}
                      {itemType === 'action' && 'Action item'}
                      {itemType === 'question' && 'Question'}
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {itemType === 'action' && (
                        <button
                          className="btn-google-icon-mini"
                          title="Add to Google Calendar"
                          onClick={() => handleAddToCalendar(item.text)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                        </button>
                      )}
                      <button
                        className="btn-google-icon-mini"
                        title="Copy to clipboard"
                        onClick={() => handleCopy(item.text, idx)}
                      >
                        {isCopied ? (
                          <span style={{ color: '#6dd58c', fontSize: '11px', fontWeight: 'bold' }}>✓</span>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="idea-text" style={{ fontSize: '13px', lineHeight: '1.5', color: '#e3e3e3' }}>{item.text}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '11.5px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a8c7fa' }} />
            <span>Extracted by Gemini</span>
          </div>
        </div>

      </div>
    </div>
  );
}
