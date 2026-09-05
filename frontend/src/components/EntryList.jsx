import MoodTrend from './MoodTrend.jsx';

const MOOD_COLOR = {
  calm: '#a8c7fa',
  happy: '#6dd58c',
  excited: '#d3e3fd',
  hopeful: '#a8c7fa',
  neutral: '#c4c7c5',
  stressed: '#f28b82',
  frustrated: '#f28b82',
  sad: '#c58af9',
  anxious: '#fdd663',
};

export default function EntryList({ entries, loading, onNewEntry, onOpenEntry, selectedId, onSeedDemo, seeding }) {
  return (
    <div className="google-surface-card sidebar-panel">
      <div className="google-card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0' }}>
        
        {/* Header & New Note CTA */}
        <div className="sidebar-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '15px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a8c7fa' }}>
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span>Notes</span>
          </div>
          <button
            className="btn-google-primary"
            style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={onNewEntry}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>New note</span>
          </button>
        </div>

        {/* Scrollable list */}
        <div className="entries-scroll-area">
          {loading && (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Loading notes…
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a8c7fa' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              </div>
              <div style={{ fontWeight: '500', color: '#e3e3e3', fontSize: '14px', marginBottom: '6px' }}>
                No notes yet
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', maxWidth: '280px', margin: '0 auto' }}>
                Speak your thoughts with voice or write a quick note to get started.
              </p>
              {onSeedDemo && (
                <button
                  className="btn-google-secondary"
                  onClick={onSeedDemo}
                  disabled={seeding}
                  style={{ marginTop: '20px', fontSize: '12px', padding: '6px 14px', borderRadius: '9999px' }}
                >
                  {seeding ? 'Loading sample…' : 'Load sample notes'}
                </button>
              )}
            </div>
          )}

          {entries.map((e) => {
            const isSelected = selectedId === e.id;
            const moodCol = MOOD_COLOR[e.mood] || '#c4c7c5';

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
                      background: moodCol
                    }} />
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)', fontSize: '11.5px' }}>{e.mood || 'note'}</span>
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {e.createdAt ? new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>

                <div style={{ fontWeight: '500', color: '#e3e3e3', fontSize: '14px', marginBottom: '4px' }}>
                  {e.title || 'Untitled Note'}
                </div>

                <p className="entry-card-summary">
                  {e.summary || 'Click to review note details…'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Mood Trend Strip at bottom of sidebar */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          <MoodTrend entries={entries} />
        </div>

      </div>
    </div>
  );
}
