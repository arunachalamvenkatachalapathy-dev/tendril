import { useEffect, useRef } from 'react';

export default function ConsciousnessModal({ entries = [], synthesis, onClose, onOpenEntry }) {
  const modalRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleBackdropClick(e) {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(4, 7, 14, 0.78)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '88vh',
          background: 'rgba(14, 18, 30, 0.96)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(168, 199, 250, 0.25)',
          borderRadius: '24px',
          boxShadow: '0 28px 70px rgba(0, 0, 0, 0.85), 0 0 35px rgba(168, 199, 250, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Top Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ffffff 10%, #a8c7fa 60%, #4285f4 100%)',
              boxShadow: '0 0 16px rgba(168, 199, 250, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#081326',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 6.8 6.8 2.4-6.8 2.4L12 22l-2.4-6.8-6.8-2.4 6.8-2.4z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#f0f4fc', letterSpacing: '-0.2px' }}>
                Overall Consciousness Synthesis
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Holistic cognitive picture synthesized from all {entries.length} conversations
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Close synthesis view"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
        }}>
          {/* 1. Macro Mind Portrait Card */}
          <div style={{
            padding: '18px 20px',
            background: 'linear-gradient(135deg, rgba(168, 199, 250, 0.08) 0%, rgba(109, 213, 140, 0.04) 100%)',
            border: '1px solid rgba(168, 199, 250, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6dd58c', boxShadow: '0 0 8px #6dd58c' }}></span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#a8c7fa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Unified Mental Landscape
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {synthesis.timeSpan || 'Multi-day Continuum'}
              </span>
            </div>

            <p style={{
              fontSize: '13.5px',
              lineHeight: '1.65',
              color: '#e3e8f4',
              margin: '0 0 14px 0',
              fontWeight: '400',
            }}>
              {synthesis.executiveSummary}
            </p>

            {/* Metric Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ padding: '4px 10px', borderRadius: '9999px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '11.5px', color: '#c7d8ff' }}>
                Primary State: <strong>{synthesis.primaryMindState || 'Focused Momentum'}</strong>
              </div>
              <div style={{ padding: '4px 10px', borderRadius: '9999px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '11.5px', color: '#6dd58c' }}>
                Resonance: <strong>{synthesis.coherenceScore || '96% Cohesive'}</strong>
              </div>
              <div style={{ padding: '4px 10px', borderRadius: '9999px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '11.5px', color: '#fdd663' }}>
                Active Sparks: <strong>{synthesis.totalSparksCount || entries.length * 3} ideas</strong>
              </div>
            </div>
          </div>

          {/* 2. Core Synthesized Pillars */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#f0f4fc', marginBottom: '10px' }}>
              Core Pillars Synthesized Across All Conversations
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {(synthesis.pillars || []).map((pillar, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: pillar.color || '#a8c7fa' }} />
                    <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#ffffff' }}>
                      {pillar.title}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                    {pillar.description}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Cross-Conversation Narrative Evolution */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#f0f4fc', marginBottom: '10px' }}>
              Cross-Timeline Realizations & Evolution
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {(synthesis.keyRealizations || []).map((rz, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderLeft: '3px solid #a8c7fa',
                    borderRadius: '0 8px 8px 0',
                    fontSize: '12px',
                    color: '#d0d7e5',
                    lineHeight: '1.5',
                  }}
                >
                  {rz}
                </div>
              ))}
            </div>
          </div>

          {/* 4. Contributing Conversations Strip */}
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Converged Conversations ({entries.length})
            </div>
            <div style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '6px',
              scrollbarWidth: 'thin',
            }}>
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => {
                    onClose();
                    onOpenEntry?.(entry.id);
                  }}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    minWidth: '140px',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(168, 199, 250, 0.1)';
                    e.currentTarget.style.borderColor = '#a8c7fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#a8c7fa', fontWeight: '600', marginBottom: '3px' }}>
                    {entry.title || 'Untitled Conversation'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recorded'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
