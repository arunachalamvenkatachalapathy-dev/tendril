import { useState } from 'react';
import { huntSearch } from '../api.js';
import HuntGlobeGraph from './HuntGlobeGraph.jsx';
import MemoryUniverse from './MemoryUniverse.jsx';

export default function HuntView({ onOpenEntry, onBack, entries = [], ideas = [] }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all'); // 'all' | 'ideas' | 'context'
  const [cosmosMode, setCosmosMode] = useState('planetary'); // 'planetary' | 'constellation'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const SUGGESTIONS = [
    'My recurring creative ideas and projects',
    'Key decisions I made recently',
    'Moments when I felt stressed or overwhelmed',
    'Action items and habit commitments',
    'Things that brought me calm or clarity',
  ];

  async function handleSearch(searchQuery = query) {
    const q = (searchQuery || '').trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await huntSearch(q, scope);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Hunt search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(text, idx) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  }

  return (
    <div className="dashboard-container" style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
        <div>
          <div className="google-eyebrow" style={{ marginBottom: '4px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa' }}>
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span>Universe &amp; AI Hunt</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '500', color: '#e3e3e3', margin: 0 }}>
            Universe
          </h1>
        </div>
        {onBack && (
          <button
            className="btn-google-secondary"
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '9999px', padding: '6px 14px', fontSize: '13px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>
        )}
      </div>

      {/* 1. FIRST: Cosmos View Mode Toggle & Universe Map */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className={`google-pill-tab ${cosmosMode === 'planetary' ? 'active' : ''}`}
          onClick={() => setCosmosMode('planetary')}
        >
          🌌 Universe Map
        </button>
        <button
          className={`google-pill-tab ${cosmosMode === 'constellation' ? 'active' : ''}`}
          onClick={() => setCosmosMode('constellation')}
        >
          🌐 Idea Constellation &amp; Cross-Day Links
        </button>
      </div>

      {/* Interactive Cosmos Map */}
      {cosmosMode === 'planetary' ? (
        <div className="google-surface-card" style={{ marginBottom: '24px', padding: '20px' }}>
          <MemoryUniverse
            entries={entries}
            onOpenEntry={onOpenEntry}
          />
        </div>
      ) : (
        <HuntGlobeGraph
          entries={entries}
          ideas={ideas}
          searchQuery={query}
          onOpenEntry={onOpenEntry}
          onSelectQuery={(q) => {
            setQuery(q);
            handleSearch(q);
          }}
        />
      )}

      {/* 2. SECOND: Hunt Search Card */}
      <div className="google-surface-card" style={{ marginBottom: '20px' }}>
        <div className="google-card-body" style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa' }}>
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
            </svg>
            <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#e3e3e3', margin: 0 }}>
              Hunt Ideas &amp; Reflections
            </h2>
          </div>

          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
            Search your journal memories, recurring thoughts, and conversational reflections with Gemini Intelligence.
          </p>

          {/* Search Bar */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
            style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}
          >
            <div style={{
              flex: 1, minWidth: '240px', position: 'relative', display: 'flex', alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-subtle)',
              borderRadius: '12px', padding: '0 14px',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a8c7fa', marginRight: '10px', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hunt an idea, topic, or question in your journal…"
                style={{
                  width: '100%', height: '46px', background: 'transparent', border: 'none',
                  color: '#e3e3e3', fontSize: '14.5px', outline: 'none',
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Scope Toggle */}
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '9999px', border: '1px solid var(--border-subtle)' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'ideas', label: 'Ideas' },
                { id: 'context', label: 'Context' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScope(s.id)}
                  style={{
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    background: scope === s.id ? '#a8c7fa' : 'transparent',
                    color: scope === s.id ? '#0f172a' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="btn-google-primary"
              style={{
                borderRadius: '9999px', padding: '10px 22px', fontSize: '13.5px',
                display: 'flex', alignItems: 'center', gap: '8px',
                opacity: (!query.trim() || loading) ? 0.6 : 1,
              }}
            >
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
                  </svg>
                  <span>Hunting…</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
                  </svg>
                  <span>Hunt</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Hunt suggestions */}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Try hunting:</span>
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => { setQuery(s); handleSearch(s); }}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)',
                  borderRadius: '9999px', padding: '3px 11px', fontSize: '11.5px',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {s}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="google-surface-card" style={{ marginBottom: '20px', padding: '32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#a8c7fa', fontSize: '14.5px', fontWeight: '500' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ animation: 'spin 1.5s linear infinite' }}>
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
            </svg>
            <span>Gemini Intelligence is hunting across your journal memory…</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px' }}>
            Cross-referencing conversations, recurring patterns, and extracted sparks.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ padding: '14px 18px', background: 'rgba(242,139,130,0.12)', border: '1px solid rgba(242,139,130,0.3)', borderRadius: '12px', color: '#f28b82', fontSize: '13px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Results View */}
      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Gemini Synthesized Discovery Answer */}
          <div className="google-surface-card" style={{
            background: 'linear-gradient(135deg, rgba(168,199,250,0.07) 0%, rgba(192,132,252,0.07) 100%)',
            border: '1px solid rgba(168,199,250,0.25)',
          }}>
            <div className="google-card-body" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa' }}>
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
                </svg>
                <span style={{ fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', color: '#a8c7fa' }}>
                  GEMINI DISCOVERY SYNTHESIS
                </span>
              </div>
              <p style={{ fontSize: '15px', color: '#f1f5f9', lineHeight: '1.7', margin: 0 }}>
                {result.answer}
              </p>

              {/* Related themes */}
              {result.relatedThemes?.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                  {result.relatedThemes.map((t, idx) => (
                    <span key={idx} className="google-chip" style={{ fontSize: '11.5px' }}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Suggested Follow-up Hunts */}
              {result.suggestedFollowUps?.length > 0 && (
                <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Continue hunting:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {result.suggestedFollowUps.map((fu, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { setQuery(fu); handleSearch(fu); }}
                        style={{
                          background: 'rgba(168,199,250,0.08)', border: '1px solid rgba(168,199,250,0.2)',
                          borderRadius: '9999px', padding: '4px 12px', fontSize: '12px',
                          color: '#a8c7fa', cursor: 'pointer',
                        }}
                      >
                        🔎 {fu}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Matched Ideas Section */}
          {result.matchedIdeas?.length > 0 && (
            <div className="google-surface-card">
              <div className="google-card-body" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#4ade80' }}>
                    <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
                  </svg>
                  <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#e3e3e3', margin: 0 }}>
                    Matched Ideas &amp; Sparks ({result.matchedIdeas.length})
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                  {result.matchedIdeas.map((idea, idx) => {
                    const text = typeof idea === 'string' ? idea : idea.text;
                    const isCopied = copiedIndex === idx;
                    return (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)',
                          borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10.5px', color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid rgba(74,222,128,0.2)' }}>
                            Spark
                          </span>
                          <button
                            type="button"
                            className="btn-google-icon-mini"
                            onClick={() => handleCopy(text, idx)}
                            title="Copy idea"
                          >
                            {isCopied ? <span style={{ color: '#6dd58c', fontSize: '11px', fontWeight: 'bold' }}>✓</span> : (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            )}
                          </button>
                        </div>
                        <p style={{ fontSize: '13px', color: '#e3e3e3', lineHeight: '1.5', margin: 0 }}>
                          {text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Matched Conversations & Reflections Section */}
          {result.matchedEntries?.length > 0 && (
            <div className="google-surface-card">
              <div className="google-card-body" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#60a5fa' }}>
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#e3e3e3', margin: 0 }}>
                    Matched Reflections ({result.matchedEntries.length})
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {result.matchedEntries.map((entry, idx) => (
                    <div
                      key={idx}
                      onClick={() => entry.entryId && onOpenEntry?.(entry.entryId)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)',
                        borderRadius: '12px', padding: '16px 20px', cursor: entry.entryId ? 'pointer' : 'default',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#e3e3e3' }}>
                            {entry.title || 'Untitled Reflection'}
                          </span>
                          {entry.date && (
                            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              • {entry.date}
                            </span>
                          )}
                        </div>
                        {entry.mood && (
                          <span className={`google-type-pill ${entry.mood}`} style={{ fontSize: '10.5px' }}>
                            {entry.mood}
                          </span>
                        )}
                      </div>
                      {entry.snippet && (
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '4px 0 8px' }}>
                          "{entry.snippet}"
                        </p>
                      )}
                      {entry.entryId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#a8c7fa', marginTop: '4px' }}>
                          <span>Read full reflection</span>
                          <span>→</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty match notice */}
          {result.matchedIdeas?.length === 0 && result.matchedEntries?.length === 0 && (
            <div className="google-surface-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13.5px' }}>
              No specific dated items directly matched this query. Try a broader search term like "work", "goals", or "calm".
            </div>
          )}

        </div>
      )}

    </div>
  );
}
