import MoodTrend from './MoodTrend.jsx';

const MOOD_COLOR = {
  calm: '#10b981',
  happy: '#06b6d4',
  excited: '#3b82f6',
  hopeful: '#10b981',
  neutral: '#94a3b8',
  stressed: '#f59e0b',
  frustrated: '#ef4444',
  sad: '#8b5cf6',
  anxious: '#ec4899',
};

export default function EntryList({ entries, loading, onNewEntry, onOpenEntry, selectedId, onSeedDemo, seeding }) {
  return (
    <div className="bezel-outer sidebar-panel">
      <div className="bezel-inner" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Header & New Entry CTA */}
        <div className="sidebar-header">
          <div className="panel-title">
            <span>🌿</span>
            <span>Journal Stream</span>
          </div>
          <button
            className="btn-tendril-primary"
            style={{ padding: '6px 12px 6px 16px', fontSize: '12px' }}
            onClick={onNewEntry}
          >
            <span>+ New</span>
            <div className="btn-inner-icon" style={{ width: '22px', height: '22px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
          </button>
        </div>

        {/* Scrollable list */}
        <div className="entries-scroll-area">
          {loading && (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Synthesizing entries…
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div style={{ padding: '36px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.6 }}>🌱</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
                Your neural journal is empty. Start a conversation in voice or text to capture your first thoughts.
              </p>
              {onSeedDemo && (
                <button
                  className="btn-tendril-secondary"
                  onClick={onSeedDemo}
                  disabled={seeding}
                  style={{ marginTop: '16px', fontSize: '12px', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                >
                  {seeding ? '⚡ Seeding Journey…' : '⚡ Load Sample Journey (Demo Mode)'}
                </button>
              )}
            </div>
          )}

          {entries.map((e) => {
            const isSelected = selectedId === e.id;
            const moodCol = MOOD_COLOR[e.mood] || '#94a3b8';

            return (
              <div
                key={e.id}
                className={`entry-card-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onOpenEntry(e.id)}
              >
                <div className="entry-card-date">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: moodCol,
                      boxShadow: `0 0 6px ${moodCol}`
                    }} />
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{e.mood || 'neutral'}</span>
                  </span>
                  <span>{e.createdAt ? new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
                </div>

                <div style={{ fontWeight: '600', color: '#f1f5f9', fontSize: '13.5px', marginBottom: '3px' }}>
                  {e.title || 'Untitled Session'}
                </div>

                <p className="entry-card-summary">
                  {e.summary || 'Click to review conversation details…'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Mood Trend Strip at bottom of sidebar */}
        <div style={{ padding: '14px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.15)' }}>
          <MoodTrend entries={entries} />
        </div>

      </div>
    </div>
  );
}
