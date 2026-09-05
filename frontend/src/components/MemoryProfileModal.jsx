import { useEffect, useState } from 'react';
import { getMemoryContext, wipeAllMemory } from '../api.js';

export default function MemoryProfileModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('recent');
  const [memoryData, setMemoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wiping, setWiping] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [error, setError] = useState(null);

  async function loadMemory() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMemoryContext();
      setMemoryData(data);
    } catch (err) {
      console.error('Failed to load memory context:', err.message);
      setError('Could not retrieve memory layers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMemory();
  }, []);

  async function handleWipe() {
    if (!window.confirm('Are you sure you want to permanently clear your journal memory? This removes all personalized reflections and context stored for your account in Firestore.')) {
      return;
    }
    setWiping(true);
    setError(null);
    try {
      await wipeAllMemory();
      setMemoryData(null);
      setWiped(true);
    } catch (err) {
      setError(err.message || 'Failed to clear memory.');
    } finally {
      setWiping(false);
    }
  }

  const nowBullets = memoryData?.now?.bullets || memoryData?.todaysIdeas || [];
  const recentSummary = memoryData?.recent?.summary || (typeof memoryData?.recent === 'string' ? memoryData?.recent : '');
  const recentTopics = memoryData?.recent?.topics || [];
  const archiveSummary = memoryData?.archive?.summary || (typeof memoryData?.archive === 'string' ? memoryData?.archive : '');
  const archiveValues = memoryData?.archive?.values || [];

  return (
    <div className="memory-modal-backdrop" onClick={onClose}>
      <div className="memory-modal-dialog google-surface-card" onClick={e => e.stopPropagation()}>
        <div className="google-card-body" style={{ padding: '32px 28px' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <div className="google-eyebrow" style={{ marginBottom: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa' }}>
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z" />
                </svg>
                <span>Gemini Memory Bank</span>
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: '500', color: '#e3e3e3' }}>
                Journal Memory & Context
              </h2>
            </div>
            
            <button
              onClick={onClose}
              className="btn-google-icon"
              style={{ width: '32px', height: '32px' }}
            >
              ✕
            </button>
          </div>

          {/* Tab Switcher */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <button
              className={`google-pill-tab ${activeTab === 'recent' ? 'active' : ''}`}
              onClick={() => setActiveTab('recent')}
            >
              Recent Context (7 Days)
            </button>
            <button
              className={`google-pill-tab ${activeTab === 'archive' ? 'active' : ''}`}
              onClick={() => setActiveTab('archive')}
            >
              Long-Term Themes
            </button>
            <button
              className={`google-pill-tab ${activeTab === 'now' ? 'active' : ''}`}
              onClick={() => setActiveTab('now')}
            >
              Today's Reflections
            </button>
          </div>

          {error && (
            <div className="google-alert-error" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {/* Content Body */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Loading memory context from Firestore…
            </div>
          ) : wiped ? (
            <div style={{
              padding: '36px',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '16px',
              border: '1px solid var(--border-subtle)'
            }}>
              <p style={{ color: '#e3e3e3', fontSize: '15px', fontWeight: '500' }}>
                Memory context has been cleared from Firestore.
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Your next journal session will begin with a clean context.
              </p>
            </div>
          ) : activeTab === 'recent' ? (
            <div className="google-memory-panel">
              <span className="google-panel-badge">
                Rolling 7-Day Context
              </span>
              {recentSummary ? (
                <>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '16px' }}>
                    {recentSummary}
                  </p>
                  {recentTopics.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {recentTopics.map((t, i) => (
                        <span key={i} className="google-chip">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  No rolling 7-day memory recorded yet. As you journal across days, Gemini summarizes your recurring themes here.
                </p>
              )}
            </div>
          ) : activeTab === 'archive' ? (
            <div className="google-memory-panel">
              <span className="google-panel-badge">
                Core Themes & Values
              </span>
              {archiveSummary ? (
                <>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '16px' }}>
                    {archiveSummary}
                  </p>
                  {archiveValues.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {archiveValues.map((v, i) => (
                        <span key={i} className="google-chip" style={{ color: '#a8c7fa' }}>
                          • {v}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Long-term themes are empty. Over weeks of journaling, your core goals and principles are preserved here.
                </p>
              )}
            </div>
          ) : (
            <div className="google-memory-panel">
              <span className="google-panel-badge">
                Active Session Context
              </span>
              {nowBullets.length > 0 ? (
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {nowBullets.map((b, i) => (
                    <li key={i} style={{
                      fontSize: '13.5px',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px'
                    }}>
                      <span style={{ color: '#a8c7fa', marginTop: '2px' }}>•</span>
                      <span>{typeof b === 'string' ? b : b.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  Today's session context is clear. New points will appear here during active conversations.
                </p>
              )}
            </div>
          )}

          {/* Footer Controls & Privacy Wipe */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Private storage scoped to your Google account
            </span>

            <button
              onClick={handleWipe}
              disabled={wiping || loading}
              className="btn-google-secondary"
              style={{
                color: '#f28b82',
                borderColor: 'rgba(242, 139, 130, 0.3)',
                padding: '6px 14px',
                fontSize: '12px'
              }}
            >
              {wiping ? 'Clearing…' : 'Clear memory context'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
