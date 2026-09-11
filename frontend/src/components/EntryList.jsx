import { useState } from 'react';
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

export default function EntryList({ entries, loading, onNewEntry, onOpenEntry, selectedId, onSeedDemo, seeding, onDeleteEntry, onRemoveDuplicates, onCleanBeyondSept2 }) {
  const [showOptions, setShowOptions] = useState(false);
  const [groupByDay, setGroupByDay] = useState(false);

  return (
    <div className="google-surface-card sidebar-panel">
      <div className="google-card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0' }}>
        
        {/* Header & New Note CTA */}
        <div className="sidebar-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <div
              className="panel-title"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '15px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setShowOptions(v => !v)}
              title="Click for note options"
            >
              <button
                type="button"
                style={{
                  background: showOptions ? 'rgba(168, 199, 250, 0.16)' : 'transparent',
                  border: showOptions ? '1px solid rgba(168, 199, 250, 0.4)' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: '#a8c7fa',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
              <span>Notes</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>▾</span>
            </div>

            {/* Options Dropdown Menu */}
            {showOptions && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '8px',
                  zIndex: 100,
                  background: '#1a1f2c',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  padding: '6px',
                  minWidth: '210px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
                onClick={() => setShowOptions(false)}
              >
                {onRemoveDuplicates && (
                  <button
                    onClick={() => { setShowOptions(false); onRemoveDuplicates(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', borderRadius: '8px',
                      background: 'transparent', border: 'none',
                      color: '#e3e3e3', fontSize: '12.5px', textAlign: 'left',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18"/>
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                    <span>Remove duplicate notes</span>
                  </button>
                )}
                {onCleanBeyondSept2 && (
                  <button
                    onClick={() => { setShowOptions(false); onCleanBeyondSept2(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', borderRadius: '8px',
                      background: 'transparent', border: 'none',
                      color: '#f28b82', fontSize: '12.5px', textAlign: 'left',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(242, 139, 130, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                    <span>Remove notes beyond Sept 2</span>
                  </button>
                )}
                <button
                  onClick={() => { setShowOptions(false); setGroupByDay(v => !v); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'transparent', border: 'none',
                    color: '#e3e3e3', fontSize: '12.5px', textAlign: 'left',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span>{groupByDay ? 'Show simple list' : 'Group notes by day'}</span>
                </button>
                <button
                  onClick={() => { setShowOptions(false); onNewEntry(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'transparent', border: 'none',
                    color: '#a8c7fa', fontSize: '12.5px', textAlign: 'left',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,199,250,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  <span>New reflection</span>
                </button>
              </div>
            )}
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
                style={{ position: 'relative' }}
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {e.createdAt ? new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                    </span>
                    {onDeleteEntry && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); onDeleteEntry(e.id); }}
                        title="Delete note"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '2px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          opacity: 0.6,
                          transition: 'opacity 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e2 => { e2.currentTarget.style.opacity = '1'; e2.currentTarget.style.color = '#f28b82'; }}
                        onMouseLeave={e2 => { e2.currentTarget.style.opacity = '0.6'; e2.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    )}
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
