// Phase 3 enhancement: renders the mood-over-time strip and frequent-theme
// chips, derived entirely from the signed-in user's own already-isolated
// entries (GET /api/entries) — no new data-isolation surface introduced.

const MOOD_COLOR = {
  calm: '#6b8f71',
  happy: '#c9a66b',
  excited: '#d98e4c',
  hopeful: '#8fb08f',
  neutral: '#8f897a',
  stressed: '#c9915f',
  frustrated: '#b5533c',
  sad: '#5f7590',
  anxious: '#a06b8f',
};

export default function MoodTrend({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="mood-trend">
        <h2>Mood over time</h2>
        <p className="trend-empty">Save a few entries and your trend will appear here.</p>
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
    <div className="mood-trend">
      <h2>Mood over time</h2>
      <div className="mood-strip" title="Each bar is one entry, oldest to newest">
        {recent.map((e) => (
          <div
            key={e.id}
            className="mood-bar"
            style={{
              height: '100%',
              background: MOOD_COLOR[e.mood] || '#8f897a',
            }}
            title={`${e.title} — ${e.mood}`}
          />
        ))}
      </div>
      {topThemes.length > 0 && (
        <div className="theme-chips">
          {topThemes.map((t) => (
            <span className="theme-chip" key={t}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
