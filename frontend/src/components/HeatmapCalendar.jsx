const COLOR = {
  worry: '#b5533c',
  happy: '#6b8f71',
  neutral: '#3a3f52',
};

export default function HeatmapCalendar({ heatmap, rangeDays }) {
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
      <div className="heatmap-grid">
        {days.map((date) => {
          const entry = byDate[date];
          const color = entry ? COLOR[entry.dominant] : 'rgba(247,243,232,0.06)';
          return (
            <div key={date} className="heatmap-cell" style={{ background: color }} title={date + (entry ? ` — ${entry.dominant}` : '')} />
          );
        })}
      </div>
      <div className="clock-legend">
        <span>
          <i className="mood-dot" style={{ background: COLOR.worry }} /> worry day
        </span>
        <span>
          <i className="mood-dot" style={{ background: COLOR.happy }} /> happy day
        </span>
        <span>
          <i className="mood-dot" style={{ background: 'rgba(247,243,232,0.2)' }} /> no entry
        </span>
      </div>
    </div>
  );
}
