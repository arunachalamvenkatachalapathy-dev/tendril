// Phase 3 enhancement: renders the mood-over-time strip and frequent-theme
// chips, derived entirely from the signed-in user's own already-isolated
// entries (GET /api/entries) — no new data-isolation surface introduced.

const MOOD_COLOR = {
  calm: '#6b8f71',
  happy: '#10b981',
  excited: '#f59e0b',
  hopeful: '#38bdf8',
  neutral: '#64748b',
  stressed: '#f97316',
  frustrated: '#ef4444',
  sad: '#6366f1',
  anxious: '#ec4899',
  energized: '#10b981',
};

export default function MoodTrend({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <div style={{
        marginTop: '20px',
        padding: '16px',
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-subtle)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Mood Trajectory
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
          Save a few entries to surface patterns.
        </p>
      </div>
    );
  }

  const recent = [...entries].reverse().slice(-14); // oldest -> newest, last 14

  const themeCounts = {};
  for (const e of entries) {
    for (const t of e.themes || []) {
      themeCounts[t] = (themeCounts[t] || 0) + 1;
    }
  }
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([theme]) => theme);

  return (
    <div style={{
      marginTop: '20px',
      padding: '16px',
      borderRadius: '16px',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
          fontWeight: '600',
        }}>
          Mood Trajectory
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          Last 14 entries
        </span>
      </div>

      {/* Mood Strip Bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        height: '14px',
        borderRadius: '6px',
        overflow: 'hidden',
        background: 'rgba(0, 0, 0, 0.4)',
        padding: '2px',
        marginBottom: '14px',
      }}>
        {recent.map((e) => (
          <div
            key={e.id}
            style={{
              flex: 1,
              height: '100%',
              borderRadius: '3px',
              background: MOOD_COLOR[e.mood] || '#10b981',
              transition: 'transform 0.15s ease',
              cursor: 'pointer',
            }}
            title={`${e.title || 'Entry'} (${e.mood || 'neutral'})`}
          />
        ))}
      </div>

      {/* Recurring Themes Chips */}
      {topThemes.length > 0 && (
        <div>
          <div style={{
            fontSize: '10px',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '8px',
          }}>
            Dominant Themes
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
          }}>
            {topThemes.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: '11px',
                  padding: '3px 9px',
                  borderRadius: '9999px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.02em',
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
