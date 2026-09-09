import { useState, useEffect, useRef, useMemo } from 'react';

// Mood color palettes for celestial bodies
const MOOD_PALETTES = {
  calm:       { fill: '#7baaf7', aura: 'rgba(123, 170, 247, 0.4)', ring: 'rgba(168, 199, 250, 0.5)' },
  hopeful:    { fill: '#a8c7fa', aura: 'rgba(168, 199, 250, 0.45)', ring: 'rgba(168, 199, 250, 0.6)' },
  energized:  { fill: '#6dd58c', aura: 'rgba(109, 213, 140, 0.45)', ring: 'rgba(109, 213, 140, 0.6)' },
  happy:      { fill: '#81c995', aura: 'rgba(129, 201, 149, 0.4)', ring: 'rgba(129, 201, 149, 0.6)' },
  focused:    { fill: '#d3e3fd', aura: 'rgba(211, 227, 253, 0.4)', ring: 'rgba(211, 227, 253, 0.5)' },
  neutral:    { fill: '#c4c7c5', aura: 'rgba(196, 199, 197, 0.3)', ring: 'rgba(196, 199, 197, 0.5)' },
  stressed:   { fill: '#f28b82', aura: 'rgba(242, 139, 130, 0.45)', ring: 'rgba(242, 139, 130, 0.6)' },
  frustrated: { fill: '#ee675c', aura: 'rgba(238, 103, 92, 0.45)', ring: 'rgba(238, 103, 92, 0.6)' },
  anxious:    { fill: '#fdd663', aura: 'rgba(253, 214, 99, 0.45)', ring: 'rgba(253, 214, 99, 0.6)' },
  sad:        { fill: '#c58af9', aura: 'rgba(197, 138, 249, 0.45)', ring: 'rgba(197, 138, 249, 0.6)' },
};

function getPalette(mood) {
  return MOOD_PALETTES[mood?.toLowerCase()] || MOOD_PALETTES.hopeful;
}

// Compute dynamic celestial radius: longer the conversation -> bigger the size!
function computePlanetSize(entry) {
  const msgCount = (entry.messages && Array.isArray(entry.messages) && entry.messages.length > 0)
    ? entry.messages.length
    : 1;

  let totalWords = 0;
  if (entry.messages && Array.isArray(entry.messages) && entry.messages.length > 0) {
    totalWords = entry.messages.reduce((sum, m) => {
      const text = typeof m === 'string' ? m : (m.text || m.content || '');
      return sum + (text.split(/\s+/).filter(Boolean).length);
    }, 0);
  } else {
    const text = (entry.summary || '') + ' ' + (entry.title || '') + ' ' + (entry.cognitiveReframing || '');
    totalWords = text.split(/\s+/).filter(Boolean).length;
  }

  // Length metric combines turn count and word count
  // Scale between 14px (short note) and 44px (deep dialogue)
  const lengthScore = msgCount * 8 + Math.min(totalWords * 0.12, 50);
  const radius = Math.min(44, Math.max(14, 12 + Math.sqrt(lengthScore * 1.7)));

  let classification = 'Asteroid Note';
  let hasRing = false;

  if (radius >= 34) {
    classification = 'Cosmic Gas Giant';
    hasRing = true;
  } else if (radius >= 25) {
    classification = 'Continental Planet';
    hasRing = radius >= 30;
  } else if (radius >= 18) {
    classification = 'Oceanic Moon';
  }

  return { radius, msgCount, totalWords, classification, hasRing };
}

// Format date cleanly
function formatDate(dateInput) {
  if (!dateInput) return 'Recent';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Recent';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
}

function formatFullDate(dateInput) {
  if (!dateInput) return 'Unrecorded Date';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Recent';
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Recent';
  }
}

export default function MemoryUniverse({ entries = [], memoryData = null, onOpenEntry }) {
  const [selectedPlanet, setSelectedPlanet] = useState(null);
  const [hoveredPlanet, setHoveredPlanet] = useState(null);
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | '7days' | 'today'
  const [searchFilter, setSearchFilter] = useState('');
  
  // Static celestial layout (no rotation, stays steady and glowing)
  const rotationAngle = 0;

  // Universe Dimensions
  const W = 760;
  const H = 760;
  const cx = W / 2;
  const cy = H / 2;

  // Filter entries based on time tab
  const filteredEntries = useMemo(() => {
    let list = [...(entries || [])];
    const now = Date.now();

    if (timeFilter === '7days') {
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      list = list.filter((e) => new Date(e.createdAt || now).getTime() >= sevenDaysAgo);
    } else if (timeFilter === 'today') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      list = list.filter((e) => new Date(e.createdAt || now).getTime() >= startOfToday.getTime());
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter((e) =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.summary || '').toLowerCase().includes(q) ||
        (e.mood || '').toLowerCase().includes(q) ||
        (e.themes || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  }, [entries, timeFilter, searchFilter]);

  // Extract memory sparks & core themes for celestial ambient bodies
  const nowBullets = memoryData?.now?.bullets || memoryData?.todaysIdeas || [];
  const archiveValues = memoryData?.archive?.values || [];

  // Generate celestial planetary objects with orbital tracks & dates
  const planets = useMemo(() => {
    const list = [];
    const count = filteredEntries.length;

    // Define 3 primary orbital tracks
    // Inner Orbit: R = 150px
    // Mid Orbit:   R = 235px
    // Outer Orbit: R = 320px
    const ORBIT_TRACKS = [150, 235, 320];

    filteredEntries.forEach((entry, idx) => {
      const trackIdx = idx % ORBIT_TRACKS.length;
      const baseRadius = ORBIT_TRACKS[trackIdx];
      // Distribute evenly along track
      const itemsInTrack = Math.ceil(count / ORBIT_TRACKS.length);
      const positionInTrack = Math.floor(idx / ORBIT_TRACKS.length);
      const baseAngle = (positionInTrack / Math.max(itemsInTrack, 1)) * Math.PI * 2 + (trackIdx * 0.7);
      
      // Speed multiplier: inner orbits revolve slightly faster
      const speedMultiplier = trackIdx === 0 ? 1.2 : trackIdx === 1 ? 0.9 : 0.65;
      const sizeInfo = computePlanetSize(entry);

      list.push({
        id: entry.id,
        entry,
        title: entry.title || 'Untitled Reflection',
        dateStr: formatDate(entry.createdAt),
        fullDateStr: formatFullDate(entry.createdAt),
        mood: entry.mood || 'calm',
        baseRadius,
        baseAngle,
        speedMultiplier,
        ...sizeInfo,
        palette: getPalette(entry.mood),
      });
    });

    return list;
  }, [filteredEntries]);

  // Sparks as glowing cometary satellites in innermost orbit
  const sparkSatellites = useMemo(() => {
    return nowBullets.slice(0, 6).map((spark, i) => {
      const text = typeof spark === 'string' ? spark : (spark?.text || 'Idea');
      const baseAngle = (i / Math.max(nowBullets.length, 1)) * Math.PI * 2;
      return {
        id: `spark-${i}`,
        text,
        baseRadius: 85,
        baseAngle,
        speedMultiplier: 1.8,
      };
    });
  }, [nowBullets]);

  // Compute live current coordinates with rotationAngle
  const livePlanets = planets.map((p) => {
    const currentAngle = p.baseAngle + rotationAngle * p.speedMultiplier;
    return {
      ...p,
      x: cx + p.baseRadius * Math.cos(currentAngle),
      y: cy + p.baseRadius * Math.sin(currentAngle),
    };
  });

  const liveSparks = sparkSatellites.map((s) => {
    const currentAngle = s.baseAngle + rotationAngle * s.speedMultiplier;
    return {
      ...s,
      x: cx + s.baseRadius * Math.cos(currentAngle),
      y: cy + s.baseRadius * Math.sin(currentAngle),
    };
  });

  // Background random fixed stars
  const fixedStars = useMemo(() => {
    const stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: (Math.sin(i * 991) * 0.5 + 0.5) * W,
        y: (Math.cos(i * 337) * 0.5 + 0.5) * H,
        r: (i % 3 === 0 ? 1.5 : 1),
        opacity: 0.25 + ((i % 5) * 0.15),
      });
    }
    return stars;
  }, [W, H]);

  // Constellation filaments connecting planets with shared moods or tags
  const constellationLines = useMemo(() => {
    const lines = [];
    for (let i = 0; i < livePlanets.length; i++) {
      for (let j = i + 1; j < livePlanets.length; j++) {
        const p1 = livePlanets[i];
        const p2 = livePlanets[j];
        const sharedMood = p1.mood === p2.mood;
        const sharedTheme = (p1.entry.themes || []).some((t) => (p2.entry.themes || []).includes(t));
        
        if (sharedMood || sharedTheme) {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 260) {
            lines.push({
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              opacity: Math.max(0.08, (1 - dist / 260) * 0.25),
              stroke: sharedMood ? p1.palette.fill : '#a8c7fa',
              isHighlighted: hoveredPlanet?.id === p1.id || hoveredPlanet?.id === p2.id,
            });
          }
        }
      }
    }
    return lines;
  }, [livePlanets, hoveredPlanet]);

  return (
    <div className="memory-universe-wrapper" style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      
      {/* Top Controls Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '14px',
        padding: '0 4px',
      }}>
        {/* Time Epoch Filters */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Conversations (${entries.length})` },
            { id: '7days', label: '7-Day Cluster' },
            { id: 'today', label: 'Today' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeFilter(tab.id)}
              className={`google-pill-tab ${timeFilter === tab.id ? 'active' : ''}`}
              style={{ fontSize: '11.5px', padding: '4px 12px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Filter planets…"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '9999px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#e3e3e3',
              width: '130px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Cosmic Legend Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '6px 14px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        marginBottom: '12px',
        fontSize: '11.5px',
        color: 'var(--text-secondary)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#a8c7fa', boxShadow: '0 0 8px #a8c7fa' }} />
            <span>Core Consciousness</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1px dashed #6dd58c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6dd58c' }} />
            </span>
            <span>Larger = Longer Conversation</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c084fc' }} />
            <span>Dated Moments</span>
          </span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
          {livePlanets.length} bodies charted
        </span>
      </div>

      {/* Main Cosmos SVG Canvas */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        maxHeight: '560px',
        background: 'radial-gradient(circle at 50% 50%, #151a24 0%, #0c0e14 70%, #06070a 100%)',
        borderRadius: '20px',
        border: '1px solid rgba(168, 199, 250, 0.15)',
        boxShadow: 'inset 0 0 60px rgba(0, 0, 0, 0.8), 0 12px 36px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden',
      }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            {/* Core Sun Radial Gradient */}
            <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="35%" stopColor="#a8c7fa" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#4285f4" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#1a73e8" stopOpacity="0" />
            </radialGradient>

            {/* Planet Gradients */}
            {livePlanets.map((p) => (
              <radialGradient key={`grad-${p.id}`} id={`grad-${p.id}`} cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                <stop offset="45%" stopColor={p.palette.fill} stopOpacity="1" />
                <stop offset="100%" stopColor="#0a0c10" stopOpacity="0.9" />
              </radialGradient>
            ))}
          </defs>

          {/* Twinkling Fixed Stars */}
          {fixedStars.map((s, idx) => (
            <circle
              key={`star-${idx}`}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#ffffff"
              opacity={s.opacity}
            />
          ))}

          {/* Orbital Track Rings */}
          <circle cx={cx} cy={cy} r={85} fill="none" stroke="rgba(168, 199, 250, 0.08)" strokeDasharray="3 5" />
          <circle cx={cx} cy={cy} r={150} fill="none" stroke="rgba(168, 199, 250, 0.1)" strokeDasharray="4 6" />
          <circle cx={cx} cy={cy} r={235} fill="none" stroke="rgba(168, 199, 250, 0.08)" strokeDasharray="5 8" />
          <circle cx={cx} cy={cy} r={320} fill="none" stroke="rgba(168, 199, 250, 0.06)" strokeDasharray="6 10" />

          {/* Constellation Filament Lines */}
          {constellationLines.map((line, idx) => (
            <line
              key={`line-${idx}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.stroke}
              strokeWidth={line.isHighlighted ? 2 : 1}
              opacity={line.isHighlighted ? 0.7 : line.opacity}
              strokeDasharray={line.isHighlighted ? 'none' : '3 4'}
              style={{ transition: 'all 0.3s ease' }}
            />
          ))}

          {/* Central Consciousness Core Star */}
          <g>
            {/* Outer corona aura */}
            <circle cx={cx} cy={cy} r={46} fill="url(#sun-glow)" opacity={0.65} />
            <circle cx={cx} cy={cy} r={22} fill="url(#sun-glow)" />
            <circle cx={cx} cy={cy} r={12} fill="#ffffff" />
            <text
              x={cx}
              y={cy + 34}
              textAnchor="middle"
              fill="#a8c7fa"
              fontSize="11.5"
              fontWeight="600"
              letterSpacing="0.5px"
              style={{ pointerEvents: 'none' }}
            >
              Consciousness
            </text>
          </g>

          {/* Spark Satellites (Innermost Orbit) */}
          {liveSparks.map((spark) => (
            <g key={spark.id}>
              <circle
                cx={spark.x}
                cy={spark.y}
                r={4}
                fill="#fdd663"
                opacity={0.85}
              />
              <circle
                cx={spark.x}
                cy={spark.y}
                r={8}
                fill="none"
                stroke="#fdd663"
                strokeWidth={0.8}
                opacity={0.35}
              />
            </g>
          ))}

          {/* Conversation Planets */}
          {livePlanets.map((p) => {
            const isHovered = hoveredPlanet?.id === p.id;
            const isSelected = selectedPlanet?.id === p.id;

            return (
              <g
                key={p.id}
                style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
                onClick={() => setSelectedPlanet(p)}
                onMouseEnter={() => setHoveredPlanet(p)}
                onMouseLeave={() => setHoveredPlanet(null)}
              >
                {/* Atmospheric Glow Aura */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.radius + (isHovered || isSelected ? 12 : 5)}
                  fill={p.palette.aura}
                  opacity={isHovered || isSelected ? 0.9 : 0.4}
                  style={{ transition: 'all 0.25s ease' }}
                />

                {/* Planetary Ring (For Gas Giants / Long Conversations) */}
                {p.hasRing && (
                  <ellipse
                    cx={p.x}
                    cy={p.y}
                    rx={p.radius * 1.75}
                    ry={p.radius * 0.48}
                    fill="none"
                    stroke={p.palette.ring}
                    strokeWidth={isHovered ? 2.5 : 1.8}
                    strokeDasharray="4 2"
                    transform={`rotate(-22, ${p.x}, ${p.y})`}
                    opacity={0.75}
                  />
                )}

                {/* Main Planetary Body */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.radius}
                  fill={`url(#grad-${p.id})`}
                  stroke={isSelected ? '#ffffff' : isHovered ? p.palette.fill : 'rgba(255, 255, 255, 0.25)'}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1}
                  style={{ transition: 'all 0.2s ease' }}
                />

                {/* DATED Pill Tag & Title Beneath Planet */}
                <g style={{ pointerEvents: 'none' }}>
                  {/* Date Badge Pill */}
                  <rect
                    x={p.x - 26}
                    y={p.y + p.radius + 6}
                    width={52}
                    height={16}
                    rx={8}
                    fill="rgba(12, 14, 20, 0.85)"
                    stroke="rgba(168, 199, 250, 0.35)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={p.x}
                    y={p.y + p.radius + 18}
                    textAnchor="middle"
                    fill="#e3e3e3"
                    fontSize="10"
                    fontWeight="500"
                  >
                    {p.dateStr}
                  </text>

                  {/* Title Preview if hovered or large */}
                  {(isHovered || isSelected || p.radius >= 32) && (
                    <text
                      x={p.x}
                      y={p.y + p.radius + 32}
                      textAnchor="middle"
                      fill="#a8c7fa"
                      fontSize="10.5"
                      fontWeight="500"
                      style={{
                        textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                      }}
                    >
                      {p.title.length > 20 ? p.title.slice(0, 18) + '…' : p.title}
                    </text>
                  )}
                </g>
              </g>
            );
          })}
        </svg>

        {/* Empty State Overlay */}
        {livePlanets.length === 0 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '30px',
            textAlign: 'center',
            background: 'rgba(10, 12, 18, 0.75)',
          }}>
            <p style={{ color: '#e3e3e3', fontSize: '15px', fontWeight: '500', marginBottom: '6px' }}>
              Cosmos Awaiting Creation
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '320px', lineHeight: '1.5' }}>
              Your conversations form glowing planetary systems here. Write or speak a journal note to seed your first world.
            </p>
          </div>
        )}
      </div>

      {/* Selected Planet HUD Inspection Drawer */}
      {selectedPlanet && (
        <div style={{
          marginTop: '16px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(168, 199, 250, 0.3)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          animation: 'fade-up 0.25s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span className="google-chip" style={{
                  background: 'rgba(168, 199, 250, 0.12)',
                  borderColor: 'rgba(168, 199, 250, 0.3)',
                  color: '#a8c7fa',
                  fontSize: '11px',
                  fontWeight: '600',
                }}>
                  📅 {selectedPlanet.fullDateStr}
                </span>
                <span className="google-chip" style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  fontSize: '11px',
                  color: selectedPlanet.palette.fill,
                  textTransform: 'capitalize',
                }}>
                  ● {selectedPlanet.mood}
                </span>
                <span className="google-chip" style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}>
                  🪐 {selectedPlanet.classification}
                </span>
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: '500', color: '#e3e3e3', margin: '4px 0 6px' }}>
                {selectedPlanet.title}
              </h3>
            </div>
            
            <button
              onClick={() => setSelectedPlanet(null)}
              className="btn-google-icon"
              style={{ width: '28px', height: '28px', fontSize: '13px' }}
            >
              ✕
            </button>
          </div>

          {/* Conversation Dimensions (Length Metrics) */}
          <div style={{
            display: 'flex',
            gap: '16px',
            padding: '10px 14px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '10px',
            marginBottom: '14px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Dialogue Turns: </span>
              <strong style={{ color: '#e3e3e3' }}>{selectedPlanet.msgCount}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Total Words: </span>
              <strong style={{ color: '#e3e3e3' }}>{selectedPlanet.totalWords}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Celestial Scale: </span>
              <strong style={{ color: selectedPlanet.palette.fill }}>{Math.round(selectedPlanet.radius)} km radius</strong>
            </div>
          </div>

          {/* Summary Excerpt */}
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '14px' }}>
            {selectedPlanet.entry.summary || 'Click below to review the full transcript and conversation turns.'}
          </p>

          {/* Cognitive Reframing if available */}
          {selectedPlanet.entry.cognitiveReframing && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(168, 199, 250, 0.05)',
              borderLeft: '3px solid #a8c7fa',
              borderRadius: '4px 8px 8px 4px',
              fontSize: '12.5px',
              color: '#d3e3fd',
              marginBottom: '14px',
              lineHeight: '1.5',
            }}>
              <strong>Reframing: </strong>
              <span>{selectedPlanet.entry.cognitiveReframing}</span>
            </div>
          )}

          {/* Themes / Tags */}
          {selectedPlanet.entry.themes && selectedPlanet.entry.themes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
              {selectedPlanet.entry.themes.map((t, idx) => (
                <span key={idx} className="google-chip" style={{ fontSize: '11px', color: '#a8c7fa' }}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Action to Open Full Conversation */}
          {onOpenEntry && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn-google-primary"
                onClick={() => onOpenEntry(selectedPlanet.id)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>Open Conversation</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
