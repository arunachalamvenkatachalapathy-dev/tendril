const CENTER = 130;
const RADIUS = 100;

function polarToXY(hour, r) {
  // 24 hours around the circle, 12 o'clock = hour 0.
  const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2;
  return {
    x: CENTER + r * Math.cos(angle),
    y: CENTER + r * Math.sin(angle),
  };
}

function dominantColor(counts) {
  const { worry, happy, neutral } = counts;
  if (worry === 0 && happy === 0 && neutral === 0) return null;
  if (worry >= happy && worry >= neutral) return '#b5533c';
  if (happy >= worry && happy >= neutral) return '#6b8f71';
  return '#8f897a';
}

export default function ClockChart({ hourly }) {
  const maxCount = Math.max(1, ...hourly.map((h) => h.worry + h.happy + h.neutral));

  return (
    <div className="clock-chart">
      <svg viewBox="0 0 260 260" width="100%" height="260">
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="rgba(247,243,232,0.12)" />
        {[0, 6, 12, 18].map((h) => {
          const pos = polarToXY(h, RADIUS + 16);
          return (
            <text key={h} x={pos.x} y={pos.y} fill="#9b9484" fontSize="11" textAnchor="middle">
              {h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}
            </text>
          );
        })}
        {hourly.map((counts, hour) => {
          const total = counts.worry + counts.happy + counts.neutral;
          const color = dominantColor(counts);
          if (!color) return null;
          const r = 12 + (total / maxCount) * (RADIUS - 20);
          const pos = polarToXY(hour, r);
          return (
            <circle
              key={hour}
              cx={pos.x}
              cy={pos.y}
              r={4 + (total / maxCount) * 5}
              fill={color}
              opacity="0.85"
            >
              <title>
                {hour}:00 — worry {counts.worry}, happy {counts.happy}, neutral {counts.neutral}
              </title>
            </circle>
          );
        })}
      </svg>
      <div className="clock-legend">
        <span>
          <i className="mood-dot" style={{ background: '#b5533c' }} /> worry
        </span>
        <span>
          <i className="mood-dot" style={{ background: '#6b8f71' }} /> happy
        </span>
        <span>
          <i className="mood-dot" style={{ background: '#8f897a' }} /> neutral
        </span>
      </div>
    </div>
  );
}
