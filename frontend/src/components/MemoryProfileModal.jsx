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
    if (!window.confirm('Are you sure you want to permanently erase your memory layers? This will clear your personal Claude-Remember profile in Firestore.')) {
      return;
    }
    setWiping(true);
    setError(null);
    try {
      await wipeAllMemory();
      setMemoryData(null);
      setWiped(true);
    } catch (err) {
      setError(err.message || 'Failed to wipe memory layers.');
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
      <div className="memory-modal-dialog bezel-outer" onClick={e => e.stopPropagation()}>
        <div className="bezel-inner" style={{ padding: '32px 28px' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#10b981',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                marginBottom: '6px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                Claude-Remember Cognitive Architecture
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: '#fff' }}>
                Neural Memory Layers
              </h2>
            </div>
            
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>

          {/* Tier Switcher Pills */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <button
              className={`nav-tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
              onClick={() => setActiveTab('recent')}
            >
              🌿 Tier 2: 7-Day Recent Rollup
            </button>
            <button
              className={`nav-tab-btn ${activeTab === 'archive' ? 'active' : ''}`}
              onClick={() => setActiveTab('archive')}
            >
              🏛️ Tier 3: Core Identity Archive
            </button>
            <button
              className={`nav-tab-btn ${activeTab === 'now' ? 'active' : ''}`}
              onClick={() => setActiveTab('now')}
            >
              ⚡ Tier 1: Ephemeral Buffer (Now)
            </button>
          </div>

          {error && (
            <div style={{
              padding: '10px 18px',
              background: 'rgba(244, 63, 94, 0.1)',
              borderRadius: '8px',
              color: '#fda4af',
              fontSize: '12.5px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {/* Content Body */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Retrieving live memory layers from Firestore…
            </div>
          ) : wiped ? (
            <div style={{
              padding: '36px',
              textAlign: 'center',
              background: 'rgba(244, 63, 94, 0.05)',
              borderRadius: '16px',
              border: '1px solid rgba(244, 63, 94, 0.2)'
            }}>
              <p style={{ color: '#fda4af', fontSize: '15px', fontWeight: '500' }}>
                All memory layers have been permanently wiped from Firestore.
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '6px' }}>
                Your next journal session will begin with a fresh, clean neural slate.
              </p>
            </div>
          ) : activeTab === 'recent' ? (
            <div className="memory-tier-card">
              <span className="tier-badge-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                Rolling Context (users/{'{uid}'}/memory/recent)
              </span>
              {recentSummary ? (
                <>
                  <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '18px' }}>
                    {recentSummary}
                  </p>
                  {recentTopics.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {recentTopics.map((t, i) => (
                        <span key={i} style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)'
                        }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontSize: '13.5px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                  No rolling 7-day memory crystallized yet. Entries are automatically compacted into this tier after recurring sessions.
                </p>
              )}
            </div>
          ) : activeTab === 'archive' ? (
            <div className="memory-tier-card">
              <span className="tier-badge-pill" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                Identity Profile (users/{'{uid}'}/memory/archive)
              </span>
              {archiveSummary ? (
                <>
                  <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '18px' }}>
                    {archiveSummary}
                  </p>
                  {archiveValues.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {archiveValues.map((v, i) => (
                        <span key={i} style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          background: 'rgba(139, 92, 246, 0.1)',
                          border: '1px solid rgba(139, 92, 246, 0.25)',
                          color: '#e9d5ff'
                        }}>
                          ✦ {v}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontSize: '13.5px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                  Core identity archive is empty. Long-term values and principles merge here across weeks of journaling.
                </p>
              )}
            </div>
          ) : (
            <div className="memory-tier-card">
              <span className="tier-badge-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                Active Session Buffer (users/{'{uid}'}/memory/now)
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
                      <span style={{ color: '#f59e0b', fontSize: '15px' }}>⚡</span>
                      <span>{typeof b === 'string' ? b : b.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '13.5px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                  Today's ephemeral buffer is clear. New insights and action points will stream here during active conversations.
                </p>
              )}
            </div>
          )}

          {/* Footer Controls & GDPR Wipe */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Data isolation: users/{'{req.uid}'}/memory/*
            </span>

            <button
              onClick={handleWipe}
              disabled={wiping || loading}
              style={{
                background: 'rgba(244, 63, 94, 0.08)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                color: '#fda4af',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {wiping ? 'Erasing…' : '🗑️ Wipe All Memory Layers (GDPR)'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
