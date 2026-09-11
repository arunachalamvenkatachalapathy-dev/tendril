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

export default function MemoryUniverse({ entries = [], memoryData = null, onOpenEntry, onDeleteEntry }) {
  const [selectedPlanet, setSelectedPlanet] = useState(null);
  const [hoveredPlanet, setHoveredPlanet] = useState(null);
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | '7days' | 'today'
  const [searchFilter, setSearchFilter] = useState('');
  const [isAnimating, setIsAnimating] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Escape key exits fullscreen
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Live orbital rotation angle (animated)
  const [rotationAngle, setRotationAngle] = useState(0);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Smooth orbital animation loop — gentle, serene, meditative cosmic drift
  useEffect(() => {
    if (!isAnimating) return;
    const animate = (timestamp) => {
      if (lastTimeRef.current !== null) {
        const delta = timestamp - lastTimeRef.current;
        // 0.000018 rad/ms → ~1 full revolution every ~95 minutes: peaceful, readable, zero jitter
        setRotationAngle((prev) => prev + delta * 0.000018);
      }
      lastTimeRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      lastTimeRef.current = null;
    };
  }, [isAnimating]);

  // Hover timeout management for smooth interactive callout
  const hoverTimeoutRef = useRef(null);
  const handlePlanetMouseEnter = (p) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredPlanet(p);
  };
  const handlePlanetMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredPlanet(null);
    }, 280);
  };
  const handleCalloutMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };
  const handleCalloutMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredPlanet(null);
    }, 200);
  };

  // Universe Dimensions
  const W = 760;
  const H = 760;
  const cx = W / 2;
  const cy = H / 2;

  // Filter entries based on time tab and de-duplicate by title
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

    // De-duplicate by normalized title to prevent stacked planets from demo data
    const seenTitles = new Set();
    list = list.filter((e) => {
      const key = (e.title || '').trim().toLowerCase();
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    });

    return list;
  }, [entries, timeFilter, searchFilter]);

  // Extract memory sparks & core themes for celestial ambient bodies
  const nowBullets = memoryData?.now?.bullets || memoryData?.todaysIdeas || [];
  const archiveValues = memoryData?.archive?.values || [];

  // Generate celestial planetary objects with orbital tracks & dates (Old Universe)
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
      const cleanId = String(entry.id || idx).replace(/[^a-zA-Z0-9_-]/g, '_');

      list.push({
        id: entry.id,
        cleanId,
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

  // Tastefully balanced stars: faint background dust + 14 gentle sparkling stars (no overcrowding)
  const { backgroundStars, sparklingStars } = useMemo(() => {
    // 36 subtle, tiny background dust stars
    const bg = [];
    for (let i = 0; i < 36; i++) {
      bg.push({
        x: (Math.sin(i * 991) * 0.5 + 0.5) * W,
        y: (Math.cos(i * 337) * 0.5 + 0.5) * H,
        r: i % 4 === 0 ? 1.2 : 0.8,
        opacity: 0.16 + ((i % 5) * 0.05),
      });
    }

    // 14 delicate sparkling diamond stars placed sparsely in open spaces
    const sparkles = [
      { id: 's1',  x: 85,  y: 95,  arm: 3.5, glowR: 7, color: '#ffffff', delay: 0.2, duration: 3.2 },
      { id: 's2',  x: 210, y: 65,  arm: 2.8, glowR: 6, color: '#a8c7fa', delay: 1.5, duration: 4.1 },
      { id: 's3',  x: 570, y: 75,  arm: 3.2, glowR: 7, color: '#ffffff', delay: 0.8, duration: 3.6 },
      { id: 's4',  x: 675, y: 115, arm: 4.0, glowR: 8, color: '#d3e3fd', delay: 2.1, duration: 4.4 },
      { id: 's5',  x: 65,  y: 270, arm: 2.6, glowR: 5, color: '#fdd663', delay: 1.1, duration: 3.0 },
      { id: 's6',  x: 695, y: 290, arm: 3.4, glowR: 7, color: '#ffffff', delay: 2.7, duration: 3.8 },
      { id: 's7',  x: 55,  y: 480, arm: 3.0, glowR: 6, color: '#a8c7fa', delay: 0.5, duration: 4.0 },
      { id: 's8',  x: 705, y: 470, arm: 3.2, glowR: 7, color: '#c58af9', delay: 1.8, duration: 3.5 },
      { id: 's9',  x: 110, y: 645, arm: 3.8, glowR: 8, color: '#ffffff', delay: 2.4, duration: 4.2 },
      { id: 's10', x: 235, y: 695, arm: 2.6, glowR: 5, color: '#d3e3fd', delay: 0.9, duration: 3.3 },
      { id: 's11', x: 540, y: 685, arm: 3.0, glowR: 6, color: '#ffffff', delay: 1.6, duration: 3.9 },
      { id: 's12', x: 660, y: 630, arm: 3.5, glowR: 7, color: '#fdd663', delay: 2.9, duration: 4.5 },
      { id: 's13', x: 380, y: 45,  arm: 2.8, glowR: 6, color: '#a8c7fa', delay: 0.4, duration: 3.7 },
      { id: 's14', x: 380, y: 715, arm: 2.8, glowR: 6, color: '#ffffff', delay: 2.0, duration: 3.4 },
    ];

    return { backgroundStars: bg, sparklingStars: sparkles };
  }, [W, H]);

  return (
    <div
      className="memory-universe-wrapper"
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? '0' : undefined,
        zIndex: isFullscreen ? 99999 : undefined,
        background: isFullscreen ? '#07090e' : undefined,
        padding: isFullscreen ? '20px' : undefined,
        overflowY: isFullscreen ? 'auto' : undefined,
        width: '100%',
        userSelect: 'none',
      }}
    >

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

        {/* Search + Orbit + Fullscreen Toggles */}
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
          <button
            onClick={() => setIsAnimating((v) => !v)}
            title={isAnimating ? 'Pause orbit' : 'Resume orbit'}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '9999px',
              padding: '4px 11px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease',
            }}
          >
            {isAnimating ? '⏸ Pause' : '⟳ Orbit'}
          </button>
          <button
            onClick={() => setIsFullscreen((v) => !v)}
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
            style={{
              background: 'linear-gradient(135deg, rgba(168, 199, 250, 0.25), rgba(197, 138, 249, 0.25))',
              border: '1px solid rgba(168, 199, 250, 0.7)',
              boxShadow: '0 0 16px rgba(168, 199, 250, 0.4)',
              borderRadius: '9999px',
              padding: '4px 13px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#c7d8ff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {isFullscreen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </>
              ) : (
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              )}
            </svg>
            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
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
      <div
        onClick={() => {
          setSelectedPlanet(null);
          setHoveredPlanet(null);
        }}
        style={{
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
            {livePlanets.map((p) => {
              const gid = `grad-${p.cleanId || String(p.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
              return (
                <radialGradient key={gid} id={gid} cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                  <stop offset="45%" stopColor={p.palette.fill} stopOpacity="1" />
                  <stop offset="100%" stopColor="#0a0c10" stopOpacity="0.9" />
                </radialGradient>
              );
            })}
            {/* Star Sparkle Keyframes */}
            <style>{`
              @keyframes cosmicSparkle {
                0%, 100% {
                  opacity: 0.18;
                  transform: scale(0.65);
                }
                50% {
                  opacity: 0.95;
                  transform: scale(1.2);
                }
              }
            `}</style>
          </defs>

          {/* Subtle Background Dust Stars */}
          {backgroundStars.map((s, idx) => (
            <circle
              key={`dust-${idx}`}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#ffffff"
              opacity={s.opacity}
            />
          ))}

          {/* Gentle Sparkling Stars (Uncrowded, Tasteful Diamond Twinkle) */}
          {sparklingStars.map((s) => (
            <g
              key={s.id}
              style={{
                animation: `cosmicSparkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
                transformOrigin: `${s.x}px ${s.y}px`,
                pointerEvents: 'none',
              }}
            >
              {/* Soft corona glow */}
              <circle cx={s.x} cy={s.y} r={s.glowR} fill={s.color} opacity={0.22} />
              {/* 4-pointed micro flare */}
              <path
                d={`M ${s.x},${s.y - s.arm} Q ${s.x},${s.y} ${s.x + s.arm},${s.y} Q ${s.x},${s.y} ${s.x},${s.y + s.arm} Q ${s.x},${s.y} ${s.x - s.arm},${s.y} Q ${s.x},${s.y} ${s.x},${s.y - s.arm}`}
                fill={s.color}
                opacity={0.88}
              />
              {/* Bright center pinpoint */}
              <circle cx={s.x} cy={s.y} r={1.1} fill="#ffffff" />
            </g>
          ))}

          {/* Orbital Track Rings */}
          <circle cx={cx} cy={cy} r={85} fill="none" stroke="rgba(168, 199, 250, 0.08)" strokeDasharray="3 5" />
          <circle cx={cx} cy={cy} r={150} fill="none" stroke="rgba(168, 199, 250, 0.1)" strokeDasharray="4 6" />
          <circle cx={cx} cy={cy} r={235} fill="none" stroke="rgba(168, 199, 250, 0.08)" strokeDasharray="5 8" />
          <circle cx={cx} cy={cy} r={320} fill="none" stroke="rgba(168, 199, 250, 0.06)" strokeDasharray="6 10" />

          {/* Central Consciousness Core Star */}
          <g>
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

          {/* Conversation Planets — all child elements rigidly locked via transform translate so aura/shadow and date never lag */}
          {livePlanets.map((p) => {
            const isHovered = hoveredPlanet?.id === p.id;
            const isSelected = selectedPlanet?.id === p.id;

            return (
              <g
                key={p.id}
                transform={`translate(${p.x}, ${p.y})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlanet((prev) => (prev?.id === p.id ? null : p));
                  setHoveredPlanet(p);
                }}
                onMouseEnter={() => handlePlanetMouseEnter(p)}
                onMouseLeave={handlePlanetMouseLeave}
              >
                {/* Atmospheric Glow Aura — centered at (0,0), perfectly locked to planet body */}
                <circle
                  cx={0}
                  cy={0}
                  r={p.radius + (isHovered || isSelected ? 12 : 5)}
                  fill={p.palette.aura}
                  opacity={isHovered || isSelected ? 0.9 : 0.4}
                />

                {/* Planetary Ring (For Gas Giants / Longer Conversations) */}
                {p.hasRing && (
                  <ellipse
                    cx={0}
                    cy={0}
                    rx={p.radius * 1.75}
                    ry={p.radius * 0.48}
                    fill="none"
                    stroke={p.palette.ring}
                    strokeWidth={isHovered ? 2.5 : 1.8}
                    strokeDasharray="4 2"
                    transform="rotate(-22)"
                    opacity={0.75}
                  />
                )}

                {/* Main Planetary Body */}
                <circle
                  cx={0}
                  cy={0}
                  r={p.radius}
                  fill={`url(#grad-${p.cleanId || String(p.id).replace(/[^a-zA-Z0-9_-]/g, '_')})`}
                  stroke={isSelected ? '#ffffff' : isHovered ? p.palette.fill : 'rgba(255, 255, 255, 0.25)'}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1}
                />

                {/* DATED Pill Tag & Title Beneath Planet — rigidly locked at (0, y) */}
                <g style={{ pointerEvents: 'none' }}>
                  {/* Date Badge Pill */}
                  <rect
                    x={-26}
                    y={p.radius + 6}
                    width={52}
                    height={16}
                    rx={8}
                    fill="rgba(12, 14, 20, 0.88)"
                    stroke="rgba(168, 199, 250, 0.35)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={0}
                    y={p.radius + 18}
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
                      x={0}
                      y={p.radius + 32}
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

        {/* Rich Interactive Callout Card (HTML overlay, positioned near hovered planet) */}
        {hoveredPlanet && (() => {
          // Convert SVG coords to percentage-based position on the container
          const pctX = (hoveredPlanet.x / W) * 100;
          const pctY = (hoveredPlanet.y / H) * 100;
          const showLeft = pctX > 58;
          const showAbove = pctY > 58;

          return (
            <div
              onMouseEnter={handleCalloutMouseEnter}
              onMouseLeave={handleCalloutMouseLeave}
              style={{
                position: 'absolute',
                left: showLeft ? 'auto' : `calc(${pctX}% + ${hoveredPlanet.radius + 12}px)`,
                right: showLeft ? `calc(${100 - pctX}% + ${hoveredPlanet.radius + 12}px)` : 'auto',
                top: showAbove ? 'auto' : `calc(${pctY}% - 30px)`,
                bottom: showAbove ? `calc(${100 - pctY}% - 30px)` : 'auto',
                width: '235px',
                background: 'rgba(15, 18, 28, 0.96)',
                border: `1.5px solid ${hoveredPlanet.palette.fill}55`,
                borderRadius: '16px',
                padding: '14px 16px',
                boxShadow: `0 12px 36px rgba(0, 0, 0, 0.65), 0 0 0 1px ${hoveredPlanet.palette.fill}25`,
                pointerEvents: 'auto',
                zIndex: 25,
                animation: 'fade-up 0.18s ease-out',
                backdropFilter: 'blur(14px)',
              }}
            >
              {/* Header: Date + Mood + Dismiss Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: hoveredPlanet.palette.fill,
                    boxShadow: `0 0 8px ${hoveredPlanet.palette.fill}`,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '11px', color: '#a8c7fa', fontWeight: '600' }}>
                    {hoveredPlanet.dateStr}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    • {hoveredPlanet.mood}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setHoveredPlanet(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: '2px 4px',
                    lineHeight: 1,
                  }}
                  title="Close callout"
                >
                  ✕
                </button>
              </div>

              {/* Planet Title */}
              <div style={{
                fontSize: '13.5px',
                fontWeight: '600',
                color: '#f0f4f9',
                marginBottom: '7px',
                lineHeight: '1.35',
              }}>
                {hoveredPlanet.title}
              </div>

              {/* Summary excerpt */}
              {hoveredPlanet.entry.summary && (
                <div style={{
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5',
                  marginBottom: '10px',
                  padding: '6px 8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  borderLeft: `2px solid ${hoveredPlanet.palette.fill}`,
                }}>
                  {hoveredPlanet.entry.summary.slice(0, 85)}{hoveredPlanet.entry.summary.length > 85 ? '…' : ''}
                </div>
              )}

              {/* Metrics row */}
              <div style={{
                display: 'flex',
                gap: '8px',
                fontSize: '10.5px',
                color: 'var(--text-muted)',
                marginBottom: '12px',
                flexWrap: 'wrap',
              }}>
                <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                  {hoveredPlanet.msgCount} turns
                </span>
                <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                  {hoveredPlanet.classification}
                </span>
              </div>

              {/* Interactive Action Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                {onOpenEntry && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEntry(hoveredPlanet.id);
                    }}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #a8c7fa 0%, #7baaf7 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      color: '#0a0d14',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <span>Open</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlanet(hoveredPlanet);
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '11.5px',
                    color: '#e3e3e3',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <span>Inspect</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </button>
              </div>
            </div>
          );
        })()}

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
      {selectedPlanet && (() => {
        const entry = selectedPlanet.entry || selectedPlanet;
        const mood = selectedPlanet.mood || entry.mood || 'calm';
        const palette = selectedPlanet.palette || getPalette(mood);
        const title = selectedPlanet.title || entry.title || 'Untitled Reflection';
        const fullDate = selectedPlanet.fullDateStr || formatFullDate(entry.createdAt);
        const classification = selectedPlanet.classification || (entry.themes?.length > 0 ? `#${entry.themes[0]} Note` : 'Reflection Globe');
        const entryId = entry.id || selectedPlanet.id;

        return (
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
                    {fullDate}
                  </span>
                  <span className="google-chip" style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    fontSize: '11px',
                    color: palette.fill,
                    textTransform: 'capitalize',
                  }}>
                    ● {mood}
                  </span>
                  <span className="google-chip" style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                  }}>
                    🪐 {classification}
                  </span>
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: '500', color: '#e3e3e3', margin: '4px 0 6px' }}>
                  {title}
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
            {entry.summary || 'Click below to review the full transcript and conversation turns.'}
          </p>

          {/* Cognitive Reframing if available */}
          {entry.cognitiveReframing && (
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
              <span>{entry.cognitiveReframing}</span>
            </div>
          )}

          {/* Themes / Tags */}
          {entry.themes && entry.themes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
              {entry.themes.map((t, idx) => (
                <span key={idx} className="google-chip" style={{ fontSize: '11px', color: '#a8c7fa' }}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons: Delete + Open Conversation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {onDeleteEntry && (
              <button
                onClick={() => {
                  onDeleteEntry(entryId);
                  setSelectedPlanet(null);
                }}
                style={{
                  background: 'rgba(242, 139, 130, 0.1)',
                  border: '1px solid rgba(242, 139, 130, 0.3)',
                  color: '#f28b82',
                  borderRadius: '9999px',
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
                Delete
              </button>
            )}
            {onOpenEntry && (
              <button
                className="btn-google-primary"
                onClick={() => onOpenEntry(entryId)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginLeft: 'auto',
                }}
              >
                <span>Open Conversation</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            )}
          </div>

        </div>
      );
    })()}

    </div>
  );
}
