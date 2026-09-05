export default function EntryDetail({ entry, onBack }) {
  if (!entry) return null;

  return (
    <div className="google-surface-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="google-card-body" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn-google-icon"
              onClick={onBack}
              title="Back to composer"
              style={{ width: '32px', height: '32px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h2 style={{ fontSize: '16px', fontWeight: '500', color: '#e3e3e3', margin: 0 }}>
              {entry.title || 'Note Details'}
            </h2>
          </div>
          <button
            className="btn-google-primary"
            onClick={onBack}
            style={{ padding: '6px 14px', borderRadius: '9999px', fontSize: '13px' }}
          >
            + New note
          </button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <strong style={{ color: '#e3e3e3' }}>Summary:</strong> {entry.summary}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
              <span className="google-chip" style={{ textTransform: 'capitalize' }}>
                Mood: {entry.mood || 'neutral'}
              </span>
              {(entry.themes || []).map((t, idx) => (
                <span key={idx} className="google-chip">
                  #{t}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(entry.messages || []).map((m, i) => (
              <div key={i} className={`message-bubble-row ${m.role === 'user' ? 'user' : 'model'}`}>
                <div className="message-meta">
                  <span>{m.role === 'user' ? 'You' : 'Tendril'}</span>
                </div>
                <div className={`message-bubble ${m.role === 'user' ? 'user' : 'model'}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
