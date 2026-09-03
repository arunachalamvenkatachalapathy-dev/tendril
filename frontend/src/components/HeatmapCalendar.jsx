const COLOR = {
  happy: '#10b981',
  excited: '#06b6d4',
  hopeful: '#34d399',
  worry: '#f43f5e',
  anxious: '#ec4899',
  stressed: '#f59e0b',
  neutral: '#475569',
};

export default function HeatmapCalendar({ heatmap = [], rangeDays = 30, onSelectDate, selectedDate }) {
  const byDate = Object.fromEntries(heatmap.map((d) => [d.date, d]));

  const days = [];
  const today = new Date();
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  return (
    <div className="heatmap">
      <div className="heatmap-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(22px, 1fr))', gap: '6px' }}>
        {days.map((date) => {
          const entry = byDate[date];
          const isSelected = selectedDate === date;
          const color = entry ? (COLOR[entry.dominant] || '#10b981') : 'rgba(255, 255, 255, 0.05)';

          return (
            <div
              key={date}
              className="heatmap-cell"
              onClick={() => entry && onSelectDate?.(date, entry)}
              style={{
                background: color,
                width: '100%',
                aspectRatio: '1/1',
                borderRadius: '5px',
                cursor: entry ? 'pointer' : 'default',
                outline: isSelected ? '2px solid #38bdf8' : 'none',
                boxShadow: entry ? `0 0 8px ${color}33` : 'none',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => { if (entry) e.currentTarget.style.transform = 'scale(1.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              title={date + (entry ? ` — Dominant: ${entry.dominant} (Click to inspect)` : ' — No entries')}
            />
          );
        })}
      </div>

      <div className="clock-legend" style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="mood-dot" style={{ background: COLOR.happy, width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }} /> Happy / Energized
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="mood-dot" style={{ background: COLOR.worry, width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }} /> Friction / Stress
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="mood-dot" style={{ background: 'rgba(255, 255, 255, 0.1)', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }} /> Inactive Day
        </span>
      </div>
    </div>
  );
}
