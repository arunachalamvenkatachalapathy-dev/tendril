import { useState, useMemo, useEffect } from 'react';

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','was','are','were','be','been','my','your','i','we','they','it',
  'as','by','from','that','this','have','had','has','not','been','about',
  'will','can','just','more','some','would','also','very','its','into',
  'felt','feeling','feel','how','what','when','where','who','which',
]);

function extractKeywords(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  );
}

function findSharedConcept(nodeA, nodeB) {
  // Check exact theme match
  if (nodeA.theme && nodeB.theme && nodeA.theme.toLowerCase() === nodeB.theme.toLowerCase()) {
    return nodeA.theme;
  }
  // Check themes array
  const themesA = nodeA.themes || [];
  const themesB = nodeB.themes || [];
  const commonTheme = themesA.find((t) => themesB.includes(t));
  if (commonTheme) return commonTheme;

  // Keyword overlap
  const wordsA = extractKeywords(nodeA.text + ' ' + (nodeA.title || ''));
  const wordsB = extractKeywords(nodeB.text + ' ' + (nodeB.title || ''));
  for (const w of wordsA) {
    if (wordsB.has(w)) return w;
  }
  return null;
}

export default function HuntGlobeGraph({
  entries = [],
  ideas = [],
  searchQuery = '',
  onOpenEntry,
  onSelectQuery,
}) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [activeConnection, setActiveConnection] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Escape key exits fullscreen
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const W = 760;
  const H = 640;
  const cx = W / 2;
  const cy = H / 2;

  // 1. Group entries by calendar day
  const daysData = useMemo(() => {
    const groups = {};
    const sorted = [...(entries || [])].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    sorted.forEach((e) => {
      const d = new Date(e.createdAt || Date.now());
      const dayKey = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (!groups[dayKey]) {
        groups[dayKey] = {
          dayKey,
          dayLabel,
          date: d,
          entries: [],
          ideas: [],
        };
      }
      groups[dayKey].entries.push(e);
    });

    // Take up to 7 most recent days with entries
    const dayList = Object.values(groups).slice(0, 7);

    // Extract 1 to 3 distinct idea nodes per day
    dayList.forEach((day, dayIndex) => {
      const dayIdeas = [];
      day.entries.forEach((e, entryIdx) => {
        // From themes
        (e.themes || []).slice(0, 2).forEach((theme, tIdx) => {
          dayIdeas.push({
            id: `idea-${day.dayKey}-${entryIdx}-theme-${tIdx}`,
            dayKey: day.dayKey,
            dayLabel: day.dayLabel,
            text: theme,
            theme,
            themes: e.themes || [],
            entryId: e.id,
            entryTitle: e.title || 'Reflection',
            mood: e.mood || 'neutral',
            type: 'theme',
          });
        });

        // From action items or cognitive reframing
        if (e.cognitiveReframing && dayIdeas.length < 3) {
          dayIdeas.push({
            id: `idea-${day.dayKey}-${entryIdx}-cog`,
            dayKey: day.dayKey,
            dayLabel: day.dayLabel,
            text: e.cognitiveReframing.slice(0, 45) + (e.cognitiveReframing.length > 45 ? '…' : ''),
            fullText: e.cognitiveReframing,
            theme: (e.themes && e.themes[0]) || 'insight',
            themes: e.themes || [],
            entryId: e.id,
            entryTitle: e.title || 'Reflection',
            mood: e.mood || 'neutral',
            type: 'insight',
          });
        }
      });

      // Deduplicate ideas within the same day
      const seen = new Set();
      day.ideas = dayIdeas.filter((item) => {
        const key = item.text.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 3);
    });

    return dayList;
  }, [entries]);

  // 2. Geometry: Position Day Globes & branched Idea Satellites
  const { dayGlobes, ideaNodes, mainLines, branchLines } = useMemo(() => {
    const dayGlobesArr = [];
    const ideaNodesArr = [];
    const mainLinesArr = [];
    const branchLinesArr = [];

    const totalDays = daysData.length;
    if (totalDays === 0) {
      return { dayGlobes: [], ideaNodes: [], mainLines: [], branchLines: [] };
    }

    const R_DAY = 150;
    const R_IDEA = 250;

    daysData.forEach((day, i) => {
      const angle = (2 * Math.PI * i) / totalDays - Math.PI / 2;
      const dx = cx + R_DAY * Math.cos(angle);
      const dy = cy + R_DAY * Math.sin(angle);

      // Calculate length of day's conversations: longer conversation -> bigger globe size
      const dayTurnCount = day.entries.reduce((sum, e) => sum + (e.messages?.length || 1), 0);
      const dayWordCount = day.entries.reduce((sum, e) => {
        if (e.messages && Array.isArray(e.messages) && e.messages.length > 0) {
          return sum + e.messages.reduce((ws, m) => ws + (m.text?.split(/\s+/).filter(Boolean).length || 0), 0);
        }
        return sum + ((e.summary || '').split(/\s+/).filter(Boolean).length || 20);
      }, 0);

      // Scale Day Globe radius: 14px to 30px
      const sizeScore = dayTurnCount * 6 + Math.min(dayWordCount * 0.12, 40);
      const radius = Math.min(30, Math.max(14, 12 + Math.sqrt(sizeScore * 1.5)));
      const hasRings = radius >= 22;

      const dayGlobeObj = {
        id: `day-${day.dayKey}`,
        dayKey: day.dayKey,
        dayLabel: day.dayLabel,
        x: dx,
        y: dy,
        angle,
        radius,
        hasRings,
        dayTurnCount,
        dayWordCount,
        entryCount: day.entries.length,
        entries: day.entries,
      };
      dayGlobesArr.push(dayGlobeObj);

      // Main line from Center Globe to this Day Globe
      mainLinesArr.push({
        id: `main-${day.dayKey}`,
        x1: cx,
        y1: cy,
        x2: dx,
        y2: dy,
        dayKey: day.dayKey,
      });

      // Position each idea node branching out from this day
      const numIdeas = day.ideas.length;
      day.ideas.forEach((idea, ideaIdx) => {
        const spreadOffset = numIdeas > 1
          ? (ideaIdx - (numIdeas - 1) / 2) * 0.38
          : 0;
        const ideaAngle = angle + spreadOffset;
        const ix = cx + R_IDEA * Math.cos(ideaAngle);
        const iy = cy + R_IDEA * Math.sin(ideaAngle);

        const ideaObj = {
          ...idea,
          x: ix,
          y: iy,
          parentDayId: dayGlobeObj.id,
        };
        ideaNodesArr.push(ideaObj);

        // Branch line from Day Globe to Idea Node
        branchLinesArr.push({
          id: `branch-${ideaObj.id}`,
          x1: dx,
          y1: dy,
          x2: ix,
          y2: iy,
          ideaId: ideaObj.id,
          dayKey: day.dayKey,
        });
      });
    });

    return {
      dayGlobes: dayGlobesArr,
      ideaNodes: ideaNodesArr,
      mainLines: mainLinesArr,
      branchLines: branchLinesArr,
    };
  }, [daysData, cx, cy]);

  // 3. Cross-Day Similar Idea Connections!
  // "then if similar idea from the other day arise then both need to be connected"
  const crossDayLinks = useMemo(() => {
    const links = [];
    for (let i = 0; i < ideaNodes.length; i++) {
      for (let j = i + 1; j < ideaNodes.length; j++) {
        const nodeA = ideaNodes[i];
        const nodeB = ideaNodes[j];

        // Must be from different days!
        if (nodeA.dayKey === nodeB.dayKey) continue;

        const shared = findSharedConcept(nodeA, nodeB);
        if (shared) {
          // Compute curve control point pulling toward center
          const midX = (nodeA.x + nodeB.x) / 2;
          const midY = (nodeA.y + nodeB.y) / 2;
          const pullFactor = 0.35;
          const ctrlX = midX + (cx - midX) * pullFactor;
          const ctrlY = midY + (cy - midY) * pullFactor;

          links.push({
            id: `link-${nodeA.id}-${nodeB.id}`,
            nodeA,
            nodeB,
            sharedConcept: shared,
            path: `M ${nodeA.x} ${nodeA.y} Q ${ctrlX} ${ctrlY} ${nodeB.x} ${nodeB.y}`,
            midX: ctrlX,
            midY: ctrlY,
          });
        }
      }
    }
    return links;
  }, [ideaNodes, cx, cy]);

  // Determine active highlights based on hover / selection / search query
  const queryLower = searchQuery.toLowerCase().trim();

  function isNodeMatch(node) {
    if (!queryLower) return false;
    return (
      (node.text || '').toLowerCase().includes(queryLower) ||
      (node.theme || '').toLowerCase().includes(queryLower) ||
      (node.entryTitle || '').toLowerCase().includes(queryLower)
    );
  }

  function isDayMatch(day) {
    if (!queryLower) return false;
    return (day.dayLabel || '').toLowerCase().includes(queryLower) ||
      day.entries.some((e) =>
        (e.title || '').toLowerCase().includes(queryLower) ||
        (e.themes || []).some((t) => t.toLowerCase().includes(queryLower))
      );
  }

  return (
    <div
      className="google-surface-card"
      style={{
        marginBottom: '24px',
        overflow: isFullscreen ? 'auto' : 'hidden',
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? '0' : undefined,
        zIndex: isFullscreen ? 99999 : undefined,
        background: isFullscreen ? '#07090e' : undefined,
        padding: isFullscreen ? '24px 32px' : undefined,
        borderRadius: isFullscreen ? '0' : undefined,
        height: isFullscreen ? '100vh' : undefined,
        boxSizing: 'border-box',
      }}
    >
      <div className="google-card-body" style={{ padding: isFullscreen ? '0' : '24px 28px' }}>
        
        {/* Header & Legend */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div className="google-eyebrow" style={{ marginBottom: '4px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa' }}>
                  <circle cx="12" cy="12" r="10" />
                </svg>
                <span>Temporal Idea Constellation</span>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#e3e3e3', margin: 0 }}>
                Cross-Day Knowledge Globe
              </h2>
            </div>

            {/* Fullscreen Button in the exact area circled in the screenshot */}
            <button
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
              style={{
                background: 'linear-gradient(135deg, rgba(168, 199, 250, 0.25), rgba(197, 138, 249, 0.25))',
                border: '1px solid rgba(168, 199, 250, 0.7)',
                boxShadow: '0 0 16px rgba(168, 199, 250, 0.4)',
                borderRadius: '9999px',
                padding: '5px 14px',
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

          {/* Visual Legend */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: '11.5px',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4285f4', boxShadow: '0 0 8px #4285f4' }} />
              <span>Center Globe</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6dd58c' }} />
              <span>Day Globe</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a8c7fa' }} />
              <span>Idea Satellite</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '18px', height: '2px', background: '#c084fc', display: 'inline-block' }} />
              <strong style={{ color: '#c084fc' }}>Cross-Day Link</strong>
            </span>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: '1.5' }}>
          Your reflections grouped by calendar days. When similar ideas arise across different days, glowing cross-day bridge lines connect them together.
        </p>

        {/* SVG Visualization Canvas */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: isFullscreen ? undefined : '760 / 640',
          maxHeight: isFullscreen ? 'calc(100vh - 160px)' : '560px',
          height: isFullscreen ? 'calc(100vh - 160px)' : undefined,
          background: 'radial-gradient(circle at 50% 50%, #151a24 0%, #0c0e14 70%, #06070a 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(168, 199, 250, 0.15)',
          boxShadow: 'inset 0 0 50px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          userSelect: 'none',
        }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <defs>
              {/* Center Globe Gradient */}
              <radialGradient id="hunt-center-globe" cx="40%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="35%" stopColor="#8ab4f8" stopOpacity="0.95" />
                <stop offset="70%" stopColor="#4285f4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#1a73e8" stopOpacity="0.4" />
              </radialGradient>

              {/* Day Globe Gradient */}
              <radialGradient id="day-globe-grad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#e6f4ea" stopOpacity="1" />
                <stop offset="45%" stopColor="#6dd58c" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#137333" stopOpacity="0.8" />
              </radialGradient>

              {/* Idea Satellite Gradient */}
              <radialGradient id="idea-satellite-grad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#a8c7fa" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.8" />
              </radialGradient>

              {/* Filter glow */}
              <filter id="glow-effect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Ambient Concentric Orbit Rings */}
            <circle cx={cx} cy={cy} r={150} fill="none" stroke="rgba(168, 199, 250, 0.08)" strokeDasharray="4 6" />
            <circle cx={cx} cy={cy} r={250} fill="none" stroke="rgba(168, 199, 250, 0.06)" strokeDasharray="6 8" />

            {/* 1. Main Lines: Center Globe → Day Globes */}
            {mainLines.map((line) => {
              const isHighlighted =
                hoveredNode?.dayKey === line.dayKey ||
                selectedNode?.dayKey === line.dayKey ||
                activeConnection?.nodeA?.dayKey === line.dayKey ||
                activeConnection?.nodeB?.dayKey === line.dayKey;

              return (
                <line
                  key={line.id}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={isHighlighted ? '#a8c7fa' : 'rgba(168, 199, 250, 0.25)'}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={isHighlighted ? 'none' : '4 3'}
                  style={{ transition: 'all 0.25s ease' }}
                />
              );
            })}

            {/* 2. Branch Lines: Day Globe → Idea Nodes */}
            {branchLines.map((branch) => {
              const isHighlighted =
                hoveredNode?.id === branch.ideaId ||
                selectedNode?.id === branch.ideaId ||
                activeConnection?.nodeA?.id === branch.ideaId ||
                activeConnection?.nodeB?.id === branch.ideaId;

              return (
                <line
                  key={branch.id}
                  x1={branch.x1}
                  y1={branch.y1}
                  x2={branch.x2}
                  y2={branch.y2}
                  stroke={isHighlighted ? '#6dd58c' : 'rgba(109, 213, 140, 0.4)'}
                  strokeWidth={isHighlighted ? 2.2 : 1.4}
                  style={{ transition: 'all 0.25s ease' }}
                />
              );
            })}

            {/* 3. Cross-Day Connecting Lines (Similar Ideas Connected!) */}
            {crossDayLinks.map((link) => {
              const isDirectlyActive =
                activeConnection?.id === link.id ||
                hoveredNode?.id === link.nodeA.id ||
                hoveredNode?.id === link.nodeB.id ||
                selectedNode?.id === link.nodeA.id ||
                selectedNode?.id === link.nodeB.id;

              return (
                <g key={link.id}>
                  {/* Glowing wide backing path */}
                  <path
                    d={link.path}
                    fill="none"
                    stroke={isDirectlyActive ? 'rgba(192, 132, 252, 0.5)' : 'rgba(192, 132, 252, 0.2)'}
                    strokeWidth={isDirectlyActive ? 6 : 4}
                    filter="url(#glow-effect)"
                  />
                  {/* Active bridge path with crisp, visible dotted pattern */}
                  <path
                    d={link.path}
                    fill="none"
                    stroke={isDirectlyActive ? '#d8b4fe' : 'rgba(192, 132, 252, 0.75)'}
                    strokeWidth={isDirectlyActive ? 2.8 : 1.8}
                    strokeDasharray={isDirectlyActive ? 'none' : '5 4'}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onClick={() => setActiveConnection(link)}
                    onMouseEnter={() => setActiveConnection(link)}
                  />
                  {/* Shared theme label pill on the curve */}
                  {isDirectlyActive && (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect
                        x={link.midX - 44}
                        y={link.midY - 10}
                        width={88}
                        height={20}
                        rx={10}
                        fill="#1e1f20"
                        stroke="#c084fc"
                        strokeWidth={1}
                      />
                      <text
                        x={link.midX}
                        y={link.midY + 4}
                        textAnchor="middle"
                        fill="#c084fc"
                        fontSize="9.5"
                        fontWeight="600"
                      >
                        #{link.sharedConcept}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* 4. Center Globe (Consciousness / Universe Core) */}
            <g
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedNode({ type: 'center' })}
            >
              {/* Outer pulsing atmospheric aura */}
              <circle cx={cx} cy={cy} r={44} fill="rgba(66, 133, 244, 0.15)" filter="url(#glow-effect)" />
              <circle cx={cx} cy={cy} r={28} fill="url(#hunt-center-globe)" stroke="#a8c7fa" strokeWidth={2} />
              <circle cx={cx} cy={cy} r={12} fill="#ffffff" opacity={0.8} />

              <text
                x={cx}
                y={cy + 42}
                textAnchor="middle"
                fill="#a8c7fa"
                fontSize="11.5"
                fontWeight="600"
                style={{ pointerEvents: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
              >
                Consciousness
              </text>
            </g>

            {/* 5. Day Globes (Main line targets from Center Globe) */}
            {dayGlobes.map((day) => {
              const isMatch = isDayMatch(day);
              const isHovered = hoveredNode?.id === day.id;
              const isSelected = selectedNode?.id === day.id;
              const r = day.radius || 15;

              return (
                <g
                  key={day.id}
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onClick={() => setSelectedNode(day)}
                  onMouseEnter={() => setHoveredNode(day)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Glowing Atmospheric Aura */}
                  <circle
                    cx={day.x}
                    cy={day.y}
                    r={r + (isMatch || isHovered || isSelected ? 12 : 6)}
                    fill="rgba(109, 213, 140, 0.25)"
                    filter="url(#glow-effect)"
                  />

                  {/* Planetary Ring for Days with longer conversations */}
                  {day.hasRings && (
                    <ellipse
                      cx={day.x}
                      cy={day.y}
                      rx={r * 1.65}
                      ry={r * 0.48}
                      fill="none"
                      stroke="rgba(109, 213, 140, 0.65)"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      transform={`rotate(-22, ${day.x}, ${day.y})`}
                    />
                  )}

                  {/* Day Globe Sphere (sized dynamically by conversation length) */}
                  <circle
                    cx={day.x}
                    cy={day.y}
                    r={r}
                    fill="url(#day-globe-grad)"
                    stroke={isSelected || isMatch ? '#ffffff' : '#6dd58c'}
                    strokeWidth={isSelected || isMatch ? 2.5 : 1.5}
                  />

                  {/* Date Badge Pill */}
                  <rect
                    x={day.x - 28}
                    y={day.y + r + 6}
                    width={56}
                    height={16}
                    rx={8}
                    fill="rgba(12, 14, 20, 0.9)"
                    stroke="rgba(109, 213, 140, 0.45)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={day.x}
                    y={day.y + r + 18}
                    textAnchor="middle"
                    fill="#e3e3e3"
                    fontSize="9.5"
                    fontWeight="600"
                    style={{ pointerEvents: 'none' }}
                  >
                    {day.dayLabel}
                  </text>
                </g>
              );
            })}

            {/* 6. Idea Satellites (Branching out from each Day Globe) */}
            {ideaNodes.map((idea) => {
              const isMatch = isNodeMatch(idea);
              const isHovered = hoveredNode?.id === idea.id;
              const isSelected = selectedNode?.id === idea.id;
              const isConn =
                activeConnection?.nodeA?.id === idea.id ||
                activeConnection?.nodeB?.id === idea.id;

              return (
                <g
                  key={idea.id}
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onClick={() => setSelectedNode(idea)}
                  onMouseEnter={() => setHoveredNode(idea)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Aura for match / hover */}
                  {(isMatch || isHovered || isSelected || isConn) && (
                    <circle
                      cx={idea.x}
                      cy={idea.y}
                      r={18}
                      fill="rgba(168, 199, 250, 0.35)"
                      filter="url(#glow-effect)"
                    />
                  )}

                  {/* Satellite Sphere */}
                  <circle
                    cx={idea.x}
                    cy={idea.y}
                    r={isHovered || isSelected || isConn ? 11 : 8.5}
                    fill="url(#idea-satellite-grad)"
                    stroke={isConn ? '#c084fc' : isSelected || isMatch ? '#ffffff' : '#a8c7fa'}
                    strokeWidth={isConn ? 2.5 : isSelected ? 2 : 1}
                  />

                  {/* Idea label text */}
                  <text
                    x={idea.x}
                    y={idea.y + 18}
                    textAnchor="middle"
                    fill={isConn ? '#c084fc' : isMatch ? '#fdd663' : '#a8c7fa'}
                    fontSize="9.5"
                    fontWeight="500"
                    style={{
                      pointerEvents: 'none',
                      textShadow: '0 2px 4px rgba(0,0,0,0.95)',
                    }}
                  >
                    {idea.text.length > 14 ? idea.text.slice(0, 12) + '…' : idea.text}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Empty state overlay */}
          {dayGlobes.length === 0 && (
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
                No Journal Days Recorded Yet
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '340px', lineHeight: '1.5' }}>
                Record thoughts or load a sample cognitive journey to see your days branch into connected idea globes.
              </p>
            </div>
          )}
        </div>

        {/* 7. Interactive Inspection Card for Selected / Connected Element */}
        {(selectedNode || activeConnection) && (
          <div style={{
            marginTop: '16px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(168, 199, 250, 0.25)',
            borderRadius: '14px',
            padding: '16px 20px',
            animation: 'fade-up 0.2s ease-out',
          }}>
            {/* If cross-day connection is clicked / active */}
            {activeConnection ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="google-chip" style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.4)' }}>
                    ✨ Connected Idea Across Days: #{activeConnection.sharedConcept}
                  </span>
                  <button onClick={() => setActiveConnection(null)} className="btn-google-icon" style={{ width: '24px', height: '24px' }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '10px' }}>
                  <div style={{ padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#6dd58c', marginBottom: '4px' }}>
                      📅 {activeConnection.nodeA.dayLabel}
                    </div>
                    <div style={{ fontSize: '13px', color: '#e3e3e3', fontWeight: '500' }}>
                      {activeConnection.nodeA.entryTitle}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      "{activeConnection.nodeA.text}"
                    </div>
                    {onOpenEntry && (
                      <button
                        className="btn-google-secondary"
                        onClick={() => onOpenEntry(activeConnection.nodeA.entryId)}
                        style={{ marginTop: '8px', fontSize: '11px', padding: '3px 10px', borderRadius: '9999px' }}
                      >
                        Open {activeConnection.nodeA.dayLabel} Note
                      </button>
                    )}
                  </div>

                  <div style={{ padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#6dd58c', marginBottom: '4px' }}>
                      📅 {activeConnection.nodeB.dayLabel}
                    </div>
                    <div style={{ fontSize: '13px', color: '#e3e3e3', fontWeight: '500' }}>
                      {activeConnection.nodeB.entryTitle}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      "{activeConnection.nodeB.text}"
                    </div>
                    {onOpenEntry && (
                      <button
                        className="btn-google-secondary"
                        onClick={() => onOpenEntry(activeConnection.nodeB.entryId)}
                        style={{ marginTop: '8px', fontSize: '11px', padding: '3px 10px', borderRadius: '9999px' }}
                      >
                        Open {activeConnection.nodeB.dayLabel} Note
                      </button>
                    )}
                  </div>
                </div>

                {onSelectQuery && (
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn-google-primary"
                      onClick={() => onSelectQuery(activeConnection.sharedConcept)}
                      style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '9999px' }}
                    >
                      Hunt similar thoughts about "{activeConnection.sharedConcept}"
                    </button>
                  </div>
                )}
              </div>
            ) : selectedNode?.dayKey && !selectedNode?.entryId ? (
              /* Selected Day Globe */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="google-chip" style={{ background: 'rgba(109, 213, 140, 0.15)', color: '#6dd58c' }}>
                      📅 {selectedNode.dayLabel}
                    </span>
                    <span style={{ fontSize: '13px', color: '#e3e3e3', fontWeight: '500' }}>
                      {selectedNode.entryCount} reflection{selectedNode.entryCount > 1 ? 's' : ''} logged
                    </span>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="btn-google-icon" style={{ width: '24px', height: '24px' }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {selectedNode.entries.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(0,0,0,0.25)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#e3e3e3' }}>
                          {entry.title || 'Untitled Note'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {entry.summary ? entry.summary.slice(0, 90) + '…' : 'Review transcript'}
                        </div>
                      </div>
                      {onOpenEntry && (
                        <button
                          className="btn-google-secondary"
                          onClick={() => onOpenEntry(entry.id)}
                          style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '9999px', whiteSpace: 'nowrap', marginLeft: '12px' }}
                        >
                          Open Note
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedNode?.entryId ? (
              /* Selected Idea Node */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="google-chip" style={{ background: 'rgba(168, 199, 250, 0.15)', color: '#a8c7fa' }}>
                      Idea Satellite • {selectedNode.dayLabel}
                    </span>
                    <span style={{ fontSize: '13.5px', color: '#e3e3e3', fontWeight: '500' }}>
                      {selectedNode.entryTitle}
                    </span>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="btn-google-icon" style={{ width: '24px', height: '24px' }}>✕</button>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px 0 12px', lineHeight: '1.5' }}>
                  "{selectedNode.fullText || selectedNode.text}"
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {onSelectQuery && (
                    <button
                      className="btn-google-secondary"
                      onClick={() => onSelectQuery(selectedNode.text)}
                      style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '9999px' }}
                    >
                      Hunt this topic
                    </button>
                  )}
                  {onOpenEntry && (
                    <button
                      className="btn-google-primary"
                      onClick={() => onOpenEntry(selectedNode.entryId)}
                      style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '9999px' }}
                    >
                      Open Full Reflection
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Selected Center Origin */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#a8c7fa' }}>
                    🌐 Hunt Origin
                  </span>
                  <button onClick={() => setSelectedNode(null)} className="btn-google-icon" style={{ width: '24px', height: '24px' }}>✕</button>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                  This epicenter branches out to all your journal days. Radiating lines connect to each day globe, and cross-day bridges connect ideas that resurface across time.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
