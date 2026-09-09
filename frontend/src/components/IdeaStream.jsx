import { useState, useEffect, useRef } from 'react';
import { synthesizeSparks } from '../api.js';

const CATEGORY_META = {
  reflect:  { label: 'Reflect',  color: '#a8c7fa', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
  schedule: { label: 'Schedule', color: '#60a5fa', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  move:     { label: 'Move',     color: '#4ade80', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v6l3 3M12 13l-3 3"/><line x1="12" y1="20" x2="12" y2="23"/></svg> },
  connect:  { label: 'Connect',  color: '#f472b6', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  explore:  { label: 'Explore',  color: '#fb923c', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
  rest:     { label: 'Rest',     color: '#c084fc', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
};

export function ActionCard({ action }) {
  const [done, setDone] = useState(false);
  const meta = CATEGORY_META[action.category] || CATEGORY_META.reflect;

  return (
    <div style={{
      background: done ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${done ? 'var(--border-subtle)' : `${meta.color}28`}`,
      borderRadius: '14px',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      opacity: done ? 0.5 : 1,
      transition: 'opacity 0.2s, border-color 0.2s',
      flex: '1 1 220px',
      minWidth: 0,
    }}>
      {/* Top row: category pill + done toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          fontSize: '10.5px', fontWeight: '600', letterSpacing: '0.04em',
          color: meta.color, background: `${meta.color}18`,
          border: `1px solid ${meta.color}30`,
          borderRadius: '9999px', padding: '2px 9px',
        }}>
          {meta.icon} {meta.label}
        </span>
        <button
          onClick={() => setDone(d => !d)}
          style={{
            width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${done ? meta.color : 'rgba(255,255,255,0.2)'}`,
            background: done ? meta.color : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          title={done ? 'Mark undone' : 'Mark done'}
        >
          {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        </button>
      </div>

      {/* Title */}
      <p style={{
        fontSize: '13.5px', fontWeight: '600', color: done ? 'var(--text-muted)' : '#e3e3e3',
        lineHeight: '1.4', margin: 0,
        textDecoration: done ? 'line-through' : 'none',
      }}>
        {action.title}
      </p>

      {/* Description */}
      {action.description && (
        <p style={{
          fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0,
        }}>
          {action.description}
        </p>
      )}

      {/* CTA buttons */}
      {(action.calendarLink || action.searchLink) && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
          {action.calendarLink && (
            <a href={action.calendarLink} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: '#60a5fa',
              background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)',
              borderRadius: '9999px', padding: '3px 10px', textDecoration: 'none',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Add to Calendar
            </a>
          )}
          {action.searchLink && (
            <a href={action.searchLink} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: '#fb923c',
              background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)',
              borderRadius: '9999px', padding: '3px 10px', textDecoration: 'none',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Explore
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function IdeaStream({ ideas = [] }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [synthesis, setSynthesis] = useState(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthError, setSynthError] = useState(null);

  function handleCopy(text, idx) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  }

  async function handleSynthesize() {
    if (ideas.length === 0) return;
    setSynthesizing(true);
    setSynthError(null);
    try {
      const result = await synthesizeSparks(ideas);
      setSynthesis(result);
    } catch (err) {
      setSynthError('Gemini synthesis failed. Try again.');
    } finally {
      setSynthesizing(false);
    }
  }

  const prevCountRef = useRef(0);
  useEffect(() => {
    if (ideas.length >= 1 && ideas.length !== prevCountRef.current && !synthesizing) {
      prevCountRef.current = ideas.length;
      handleSynthesize();
    }
  }, [ideas.length]);

  return (
    <div className="google-surface-card idea-stream-col">
      <div className="google-card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0' }}>

        {/* Header */}
        <div className="idea-stream-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '15px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa' }}>
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z" />
            </svg>
            <span>Sparks</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '11.5px', color: 'var(--text-secondary)',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '2px 10px', borderRadius: '9999px',
              border: '1px solid var(--border-subtle)',
            }}>
              {ideas.length} sparks
            </span>
            {ideas.length >= 1 && (
              <button
                onClick={handleSynthesize}
                disabled={synthesizing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  fontSize: '11.5px', fontWeight: '600',
                  color: synthesizing ? 'var(--text-muted)' : '#a8c7fa',
                  background: synthesizing ? 'rgba(168,199,250,0.04)' : 'rgba(168,199,250,0.1)',
                  border: '1px solid rgba(168,199,250,0.25)',
                  borderRadius: '9999px', padding: '4px 12px', cursor: synthesizing ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                }}
                title="Synthesize sparks with Gemini Intelligence"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
                </svg>
                {synthesizing ? 'Synthesizing…' : 'Synthesize'}
              </button>
            )}
          </div>
        </div>

        {/* Stream scroll area */}
        <div className="idea-cards-scroll">

          {/* Gemini Synthesizing banner */}
          {synthesizing && (
            <div style={{
              margin: '16px 16px 0',
              padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(168,199,250,0.08) 0%, rgba(192,132,252,0.08) 100%)',
              border: '1px solid rgba(168,199,250,0.25)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa', flexShrink: 0 }}>
                <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
              </svg>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#a8c7fa' }}>
                  Gemini Intelligence Synthesizing…
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Connecting thoughts and uncovering core threads
                </div>
              </div>
            </div>
          )}

          {/* Synthesis error */}
          {synthError && (
            <div style={{ margin: '16px 16px 0', padding: '12px 16px', background: 'rgba(242,139,130,0.08)', border: '1px solid rgba(242,139,130,0.2)', borderRadius: '12px', fontSize: '12.5px', color: '#f28b82' }}>
              {synthError}
            </div>
          )}

          {synthesis && (
            <div style={{
              margin: '16px 16px 0',
              background: 'linear-gradient(135deg, rgba(168,199,250,0.06) 0%, rgba(192,132,252,0.06) 100%)',
              border: '1px solid rgba(168,199,250,0.18)',
              borderRadius: '14px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {/* Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', fontWeight: '600', color: '#a8c7fa', letterSpacing: '0.06em' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa' }}>
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
                </svg>
                GEMINI SYNTHESIS
              </div>

              {/* Main synthesis */}
              <p style={{ fontSize: '13.5px', color: '#e3e3e3', lineHeight: '1.65', margin: 0 }}>
                {synthesis.synthesis}
              </p>

              {/* Top spark callout */}
              {synthesis.topSpark && (
                <div style={{
                  background: 'rgba(168,199,250,0.08)',
                  border: '1px solid rgba(168,199,250,0.2)',
                  borderRadius: '10px', padding: '10px 14px',
                  fontSize: '12.5px', color: '#a8c7fa', lineHeight: '1.5',
                }}>
                  <span style={{ fontWeight: '600', fontSize: '10px', letterSpacing: '0.06em' }}>TOP SPARK · </span>
                  {synthesis.topSpark}
                </div>
              )}

              {/* Patterns */}
              {synthesis.patterns?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {synthesis.patterns.map((p, i) => (
                    <span key={i} className="google-chip" style={{ fontSize: '11px' }}>#{p}</span>
                  ))}
                </div>
              )}

              {/* Nudge */}
              {synthesis.nudge && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0, lineHeight: '1.5' }}>
                  💬 {synthesis.nudge}
                </p>
              )}

              <button
                onClick={() => setSynthesis(null)}
                style={{
                  alignSelf: 'flex-end', fontSize: '11px', color: 'var(--text-muted)',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px',
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {ideas.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', margin: 'auto' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a8c7fa' }}>
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
                </svg>
              </div>
              <div style={{ fontWeight: '500', color: '#e3e3e3', fontSize: '14px', marginBottom: '6px' }}>No sparks yet</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', maxWidth: '260px', margin: '0 auto' }}>
                Key ideas extracted from your reflections will appear here. Hit "Synthesize" when you have a few.
              </p>
            </div>
          ) : (
            ideas.map((item, idx) => {
              const itemType = (item.type || 'idea').toLowerCase();
              const isCopied = copiedIndex === idx;
              const text = typeof item === 'string' ? item : (item.text || '');

              return (
                <div key={idx} className="google-insight-card">
                  <div className="idea-card-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className={`google-type-pill ${itemType}`}>
                      {itemType === 'reframing' && 'Reframe'}
                      {(itemType === 'spark' || itemType === 'idea') && 'Idea'}
                      {itemType === 'insight' && 'Insight'}
                      {itemType === 'action' && 'Action item'}
                      {itemType === 'question' && 'Question'}
                    </span>
                    <button
                      className="btn-google-icon-mini"
                      title="Copy"
                      onClick={() => handleCopy(text, idx)}
                    >
                      {isCopied ? (
                        <span style={{ color: '#6dd58c', fontSize: '11px', fontWeight: 'bold' }}>✓</span>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="idea-text" style={{ fontSize: '13px', lineHeight: '1.5', color: '#e3e3e3' }}>{text}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
          fontSize: '11.5px', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a8c7fa' }} />
            <span>Extracted &amp; synthesized by Gemini</span>
          </div>
        </div>
      </div>
    </div>
  );
}
