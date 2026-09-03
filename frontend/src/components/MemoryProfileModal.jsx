import { useState } from 'react';

export default function MemoryProfileModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('recent');
  const [wiping, setWiping] = useState(false);
  const [wiped, setWiped] = useState(false);

  const mockMemory = {
    now: {
      date: 'Today',
      bullets: [
        'Explored architectural trade-offs of WebSockets vs REST relays',
        'Contemplated focus strategies for late evening fatigue',
        'Prioritized data isolation verification for project Tendril'
      ]
    },
    recent: {
      period: 'Rolling 7 Days',
      summary: `The user has been intensely focused on building production-grade AI applications with enterprise-level security boundaries. Strong interest in autonomous agents, multimodal voice systems, and cognitive memory models. Notable recurring theme of wanting tools that respect privacy and sovereignty while removing friction from the creative brainstorming process.`,
      topics: ['Google Cloud Security', 'Gemini Live API', 'Cognitive Distillation', 'Flow States']
    },
    archive: {
      period: 'Long-Term Core Identity',
      summary: `High-conviction builder with deep curiosity in systems architecture, human-computer symbiosis, and agentic workflows. Values rigorous engineering foundations over quick prototypes. Regularly seeks to bridge theoretical ideas into robust, deployed production software.`,
      values: ['Architectural Rigor', 'Sovereignty', 'Continuous Synthesis', 'High Agency']
    }
  };

  async function handleWipe() {
    if (!window.confirm('Are you sure you want to permanently erase your memory layers? This cannot be undone.')) {
      return;
    }
    setWiping(true);
    try {
      // simulate wipe
      await new Promise(r => setTimeout(r, 600));
      setWiped(true);
    } finally {
      setWiping(false);
    }
  }

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

          {/* Content Body */}
          {wiped ? (
            <div style={{
              padding: '36px',
              textAlign: 'center',
              background: 'rgba(244, 63, 94, 0.05)',
              borderRadius: '16px',
              border: '1px solid rgba(244, 63, 94, 0.2)'
            }}>
              <p style={{ color: '#fda4af', fontSize: '15px', fontWeight: '500' }}>
                Memory layers have been completely erased.
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '6px' }}>
                Your next conversation will start with a fresh, clean slate.
              </p>
            </div>
          ) : activeTab === 'recent' ? (
            <div className="memory-tier-card">
              <span className="tier-badge-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                Rolling Context (users/{'{uid}'}/memory/recent)
              </span>
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '18px' }}>
                {mockMemory.recent.summary}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {mockMemory.recent.topics.map((t, i) => (
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
            </div>
          ) : activeTab === 'archive' ? (
            <div className="memory-tier-card">
              <span className="tier-badge-pill" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                Identity Profile (users/{'{uid}'}/memory/archive)
              </span>
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '18px' }}>
                {mockMemory.archive.summary}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {mockMemory.archive.values.map((v, i) => (
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
            </div>
          ) : (
            <div className="memory-tier-card">
              <span className="tier-badge-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                Active Session Buffer (users/{'{uid}'}/memory/now)
              </span>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {mockMemory.now.bullets.map((b, i) => (
                  <li key={i} style={{ fontSize: '13.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#f59e0b' }}>•</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={handleWipe}
              disabled={wiping || wiped}
              style={{
                background: 'transparent',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#fb7185',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {wiping ? 'Erasing…' : '🗑️ Wipe All Memory Layers (GDPR)'}
            </button>

            <button
              className="btn-tendril-secondary"
              onClick={onClose}
            >
              Done
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
