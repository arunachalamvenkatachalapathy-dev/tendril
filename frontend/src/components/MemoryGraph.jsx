import { useState } from 'react';

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','was','are','were','be','been','my','your','i','we','they','it',
  'as','by','from','that','this','have','had','has','not','been','about',
  'will','can','just','more','some','would','also','very','its','into',
]);

function sharedKeywordCount(textA, textB) {
  const words = (t) =>
    new Set(
      String(t || '')
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
    );
  const A = words(textA);
  const B = words(textB);
  return [...A].filter((w) => B.has(w)).length;
}

function radialPos(index, total, cx, cy, radius) {
  const angle = (2 * Math.PI * index) / Math.max(total, 1) - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

const COLORS = {
  self:    '#a8c7fa',
  archive: '#c084fc',
  recent:  '#60a5fa',
  now:     '#4ade80',
};

const RADII = { self: 14, archive: 11, recent: 9, now: 7 };

export default function MemoryGraph({ memoryData }) {
  const [hovered, setHovered] = useState(null);

  const archiveValues = memoryData?.archive?.values || [];
  const recentTopics  = memoryData?.recent?.topics  || [];
  const nowBullets    = (memoryData?.now?.bullets || memoryData?.todaysIdeas || []).slice(0, 5);

  const hasData =
    archiveValues.length > 0 || recentTopics.length > 0 || nowBullets.length > 0;

  if (!hasData) {
    return (
      <div style={{
        textAlign: 'center', padding: '48px 20px',
        color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.7',
      }}>
        Your thought web is empty — keep journaling and it will grow here.
      </div>
    );
  }

  const W = 360, H = 360, cx = W / 2, cy = H / 2;
  const R_ARCH = 72, R_REC = 138, R_NOW = 192;

  // Build nodes
  const nodes = [{ id: 'self', label: 'You', x: cx, y: cy, layer: 'self' }];

  archiveValues.forEach((v, i) => {
    const p = radialPos(i, archiveValues.length, cx, cy, R_ARCH);
    nodes.push({ id: `arch-${i}`, label: String(v), x: p.x, y: p.y, layer: 'archive' });
  });

  recentTopics.forEach((t, i) => {
    const p = radialPos(i, recentTopics.length, cx, cy, R_REC);
    nodes.push({ id: `rec-${i}`, label: String(t), x: p.x, y: p.y, layer: 'recent' });
  });

  nowBullets.forEach((b, i) => {
    const label = typeof b === 'string' ? b : (b?.text || '');
    const p = radialPos(i, nowBullets.length, cx, cy, R_NOW);
    nodes.push({ id: `now-${i}`, label: label, x: p.x, y: p.y, layer: 'now' });
  });

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // Build edges
  const edges = [];
  const archNodes = nodes.filter((n) => n.layer === 'archive');
  const recNodes  = nodes.filter((n) => n.layer === 'recent');
  const nowNodes  = nodes.filter((n) => n.layer === 'now');

  // Center → archive (always)
  archNodes.forEach((n) => edges.push({ from: 'self', to: n.id, w: 1.2 }));
  // Center → recent (fallback when no archive)
  if (archNodes.length === 0) {
    recNodes.forEach((n) => edges.push({ from: 'self', to: n.id, w: 0.7 }));
  }

  // Archive ↔ recent — keyword overlap, fallback to all-to-all at low opacity
  const hasArchRec = archNodes.length > 0 && recNodes.length > 0;
  if (hasArchRec) {
    let linked = 0;
    archNodes.forEach((a) =>
      recNodes.forEach((r) => {
        const score = sharedKeywordCount(a.label, r.label);
        if (score > 0) { edges.push({ from: a.id, to: r.id, w: 0.6 }); linked++; }
      })
    );
    if (linked === 0) {
      // No keyword match — connect with faint fallback
      archNodes.forEach((a) =>
        recNodes.forEach((r) => edges.push({ from: a.id, to: r.id, w: 0.2 }))
      );
    }
  }

  // Recent ↔ now — keyword overlap, fallback
  const hasRecNow = recNodes.length > 0 && nowNodes.length > 0;
  if (hasRecNow) {
    let linked = 0;
    recNodes.forEach((r) =>
      nowNodes.forEach((n) => {
        const score = sharedKeywordCount(r.label, n.label);
        if (score > 0) { edges.push({ from: r.id, to: n.id, w: 0.5 }); linked++; }
      })
    );
    if (linked === 0) {
      recNodes.slice(0, 2).forEach((r) =>
        nowNodes.forEach((n) => edges.push({ from: r.id, to: n.id, w: 0.2 }))
      );
    }
  }

  // Archive ↔ now (skip if already linked via recent)
  if (archNodes.length > 0 && nowNodes.length > 0 && recNodes.length === 0) {
    archNodes.forEach((a) =>
      nowNodes.forEach((n) => {
        const score = sharedKeywordCount(a.label, n.label);
        if (score > 0) edges.push({ from: a.id, to: n.id, w: 0.5 });
      })
    );
  }

  const hoveredNode = hovered ? nodeMap[hovered] : null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {[
          { color: COLORS.archive, label: 'Core themes' },
          { color: COLORS.recent,  label: '7-day topics' },
          { color: COLORS.now,     label: "Today's sparks" },
        ].map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
            {l.label}
          </div>
        ))}
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Guide rings */}
        {[R_ARCH, R_REC, R_NOW].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r}
            fill="none" stroke="rgba(168,199,250,0.06)" strokeWidth="1" strokeDasharray="4 5" />
        ))}

        {/* Edges */}
        {edges.map((e, i) => {
          const a = nodeMap[e.from], b = nodeMap[e.to];
          if (!a || !b) return null;
          const isHighlit = hovered && (e.from === hovered || e.to === hovered);
          return (
            <line key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={isHighlit ? 'rgba(168,199,250,0.55)' : `rgba(168,199,250,${e.w * 0.22})`}
              strokeWidth={isHighlit ? 1.5 : e.w}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const isHov = hovered === n.id;
          const color = COLORS[n.layer] || COLORS.recent;
          const r = RADII[n.layer] || 8;
          const truncLabel = n.label.length > 16 ? n.label.slice(0, 15) + '…' : n.label;

          return (
            <g key={n.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(n.id)}
              onTouchEnd={() => setTimeout(() => setHovered(null), 1400)}
            >
              {/* Glow ring when hovered */}
              {isHov && (
                <circle cx={n.x} cy={n.y} r={r + 7}
                  fill="none" stroke={color} strokeWidth="1.2" strokeOpacity="0.35" />
              )}
              <circle
                cx={n.x} cy={n.y}
                r={isHov ? r + 2.5 : r}
                fill={color}
                fillOpacity={isHov ? 1 : 0.78}
              />
              {n.layer === 'self' ? (
                <text x={n.x} y={n.y + 4} textAnchor="middle"
                  fontSize="9.5" fontWeight="600" fill="#0f1117" style={{ userSelect: 'none' }}>
                  {n.label}
                </text>
              ) : (
                <text x={n.x} y={n.y + r + 11} textAnchor="middle"
                  fontSize="8.5"
                  fill={isHov ? color : 'rgba(255,255,255,0.48)'}
                  style={{ userSelect: 'none' }}>
                  {truncLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Full label tooltip at bottom */}
      <div style={{
        minHeight: '34px',
        marginTop: '8px',
        padding: '7px 12px',
        borderRadius: '8px',
        background: hoveredNode && hoveredNode.layer !== 'self' ? 'rgba(168,199,250,0.07)' : 'transparent',
        border: hoveredNode && hoveredNode.layer !== 'self' ? '1px solid rgba(168,199,250,0.14)' : '1px solid transparent',
        fontSize: '12px',
        color: hoveredNode ? COLORS[hoveredNode.layer] : 'transparent',
        lineHeight: '1.5',
        transition: 'all 0.15s',
        wordBreak: 'break-word',
      }}>
        {hoveredNode && hoveredNode.layer !== 'self' ? hoveredNode.label : '\u00A0'}
      </div>
    </div>
  );
}
