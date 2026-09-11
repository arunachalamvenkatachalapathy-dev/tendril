import { useState, useEffect, useRef } from 'react';

export const FEEL_SONGS = [
  {
    id: 'lofi-calm',
    title: 'Lofi Beats to Reflect & Journal',
    artist: 'Lofi Girl / 1 A.M Study Session',
    mood: 'calm',
    moodLabel: 'Calm & Warm',
    color: '#6dd58c',
    videoId: 'lTRiuFIWV54',
    description: 'Cozy, gentle downtempo continuous stream to slow down mental chatter.',
  },
  {
    id: 'synthwave-drive',
    title: 'Synthwave & Cinematic Drive',
    artist: 'Lofi Girl Synthwave Radio',
    mood: 'energized',
    moodLabel: 'Cinematic & Drive',
    color: '#a8c7fa',
    videoId: '4xDzrJKXOOY',
    description: 'Energetic retro electronic rhythms for deep momentum and problem solving.',
  },
  {
    id: 'alpha-waves',
    title: 'Deep Focus & Flow State',
    artist: 'Yellow Brick Cinema / Alpha Waves',
    mood: 'focused',
    moodLabel: 'Deep Flow',
    color: '#fdd663',
    videoId: 'WPni755-Krg',
    description: 'Continuous binaural alpha waves to sustain unbroken focus during writing or reflection.',
  },
  {
    id: 'peaceful-piano',
    title: 'Peaceful Piano & Solitude',
    artist: 'Peder B. Helland / Classical Stream',
    mood: 'calm',
    moodLabel: 'Peaceful Piano',
    color: '#c58af9',
    videoId: 'lCOF9LN_Zxs',
    description: 'Solitary, emotional piano melodies for introspective contemplation.',
  },
  {
    id: 'rain-ambient',
    title: 'Rain on Window & Soft Thunder',
    artist: 'Relaxing Ambience ASMR',
    mood: 'calm',
    moodLabel: 'Peaceful Rain',
    color: '#78a9ff',
    videoId: 'mPZkdNFkNps',
    description: 'Continuous soothing raindrops and distant thunder for calming anxiety.',
  },
  {
    id: 'jazz-warmth',
    title: 'Slow Jazz Piano & Morning Warmth',
    artist: 'Cafe Music BGM 24/7 Stream',
    mood: 'happy',
    moodLabel: 'Uplifting Clarity',
    color: '#ffb74d',
    videoId: 'Dx5qFachd3A',
    description: 'Warm, cozy coffeehouse jazz piano to inspire optimism and clarity.',
  },
];

/**
 * Parses any YouTube link, playlist, or video ID
 */
export function parseYouTubeInput(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. Playlist URL
  const listMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (listMatch) {
    return { type: 'playlist', id: listMatch[1] };
  }

  // 2. Standard watch URL: v=...
  const vMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (vMatch) {
    return { type: 'video', id: vMatch[1] };
  }

  // 3. Short link: youtu.be/...
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) {
    return { type: 'video', id: shortMatch[1] };
  }

  // 4. Embed link
  const embedMatch = trimmed.match(/\/embed\/([a-zA-Z0-9_-]+)/);
  if (embedMatch) {
    return { type: embedMatch[1].startsWith('PL') ? 'playlist' : 'video', id: embedMatch[1] };
  }

  // 5. Raw 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: 'video', id: trimmed };
  }
  if (/^(PL|RD|UU)[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { type: 'playlist', id: trimmed };
  }

  return { type: 'video', id: trimmed };
}

/**
 * Constructs a verified embed URL
 */
export function getEmbedUrl(track) {
  if (!track) return '';

  if (track.customUrl) {
    const parsed = parseYouTubeInput(track.customUrl);
    if (parsed) {
      if (parsed.type === 'playlist') {
        return 'https://www.youtube.com/embed/videoseries?list=' + parsed.id + '&autoplay=1&enablejsapi=1&playsinline=1';
      }
      return 'https://www.youtube.com/embed/' + parsed.id + '?autoplay=1&enablejsapi=1&playsinline=1';
    }
  }

  if (track.playlistId) {
    return 'https://www.youtube.com/embed/videoseries?list=' + track.playlistId + '&autoplay=1&enablejsapi=1&playsinline=1';
  }

  const vId = track.videoId || 'lTRiuFIWV54';
  return 'https://www.youtube.com/embed/' + vId + '?autoplay=1&enablejsapi=1&playsinline=1';
}

/**
 * Global helper to play music in the app from anywhere
 */
export function playInAppMusic(trackOrQuery) {
  if (!trackOrQuery) return;
  let track = trackOrQuery;
  if (typeof trackOrQuery === 'string') {
    const found = FEEL_SONGS.find(s => 
      s.title.toLowerCase().includes(trackOrQuery.toLowerCase()) ||
      s.mood.toLowerCase().includes(trackOrQuery.toLowerCase()) ||
      s.moodLabel.toLowerCase().includes(trackOrQuery.toLowerCase())
    );
    track = found || FEEL_SONGS[0];
  }
  window.dispatchEvent(new CustomEvent('tendril:playMusic', { detail: track }));
}

/**
 * Boards of Feel Songs component for dashboard
 */
export function FeelSongsBoards({ onSelectSong, currentTrackId }) {
  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
          <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#e3e3e3', margin: 0 }}>
            Feel Songs &amp; Mood Soundscapes
          </h3>
          <span style={{
            fontSize: '11px',
            color: '#a8c7fa',
            background: 'rgba(168, 199, 250, 0.1)',
            padding: '2px 8px',
            borderRadius: '9999px',
            border: '1px solid rgba(168, 199, 250, 0.2)',
          }}>
            Runs in-app
          </span>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Click any board to stream music or change links
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '12px',
      }}>
        {FEEL_SONGS.map((song) => {
          const isPlaying = currentTrackId === song.id;
          return (
            <div
              key={song.id}
              onClick={() => {
                if (onSelectSong) onSelectSong(song);
                playInAppMusic(song);
              }}
              style={{
                background: isPlaying
                  ? 'linear-gradient(135deg, rgba(168, 199, 250, 0.15), rgba(197, 138, 249, 0.12))'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isPlaying
                  ? '1px solid ' + song.color
                  : '1px solid var(--border-subtle)',
                boxShadow: isPlaying ? '0 0 16px ' + song.color + '40' : 'none',
                borderRadius: '12px',
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                if (!isPlaying) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              }}
              onMouseLeave={(e) => {
                if (!isPlaying) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: song.color,
                    background: song.color + '18',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    border: '1px solid ' + song.color + '40',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    letterSpacing: '0.02em',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: song.color }} />
                    <span>{song.moodLabel}</span>
                  </span>

                  {isPlaying && (
                    <span style={{ fontSize: '11px', color: song.color, fontWeight: '600' }}>
                      ● Active
                    </span>
                  )}
                </div>

                <div style={{ fontWeight: '500', color: '#f0f3f8', fontSize: '13.5px', marginBottom: '3px' }}>
                  {song.title}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {song.artist}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  {song.description}
                </p>
              </div>

              <div style={{
                marginTop: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}>
                <span style={{ fontSize: '11px', color: isPlaying ? song.color : 'var(--text-dim)', fontWeight: '500' }}>
                  {isPlaying ? '● Playing in App' : 'Play Track'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Continuous Stream
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Helper to get initial remembered track
 */
function getInitialTrack(initialTrack) {
  if (initialTrack) return initialTrack;
  try {
    const saved = localStorage.getItem('tendril_last_track');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.videoId || parsed.customUrl)) return parsed;
    }
  } catch (e) {}
  return FEEL_SONGS[0];
}

/**
 * Floating Glassmorphic Music Widget
 * Single persistent iframe that NEVER unmounts on expand/minimize.
 * Calm, subtle, non-flashy 42px round glass button.
 */
export function InAppMusicPlayer({ track }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [activeTrack, setActiveTrack] = useState(() => getInitialTrack(track));
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync track when external event fires
  useEffect(() => {
    if (track) {
      setActiveTrack(track);
      setIsPlaying(true);
      try {
        localStorage.setItem('tendril_last_track', JSON.stringify(track));
      } catch (e) {}
    }
  }, [track]);

  function handleSelectTrack(newTrack) {
    setActiveTrack(newTrack);
    setIsPlaying(true);
    setShowChangeModal(false);
    try {
      localStorage.setItem('tendril_last_track', JSON.stringify(newTrack));
    } catch (e) {}
  }

  function handleApplyCustomUrl(e) {
    e?.preventDefault();
    if (!customInput.trim()) return;
    const parsed = parseYouTubeInput(customInput.trim());
    if (!parsed) return;

    const newTrack = {
      id: 'custom-' + Date.now(),
      title: 'Custom YouTube Stream',
      artist: 'User Link',
      customUrl: customInput.trim(),
      videoId: parsed.type === 'video' ? parsed.id : null,
      playlistId: parsed.type === 'playlist' ? parsed.id : null,
      moodLabel: 'Custom Playlist',
      color: '#a8c7fa',
    };
    handleSelectTrack(newTrack);
    setCustomInput('');
  }

  // Next / Previous station switchers
  function handleNextTrack() {
    const currentIndex = FEEL_SONGS.findIndex(s => s.id === activeTrack.id || s.videoId === activeTrack.videoId);
    const nextIndex = (currentIndex + 1) % FEEL_SONGS.length;
    handleSelectTrack(FEEL_SONGS[nextIndex]);
  }

  function handlePrevTrack() {
    const currentIndex = FEEL_SONGS.findIndex(s => s.id === activeTrack.id || s.videoId === activeTrack.videoId);
    const prevIndex = (currentIndex - 1 + FEEL_SONGS.length) % FEEL_SONGS.length;
    handleSelectTrack(FEEL_SONGS[prevIndex]);
  }

  const youtubeWatchUrl = activeTrack.customUrl || (activeTrack.videoId ? 'https://www.youtube.com/watch?v=' + activeTrack.videoId : 'https://www.youtube.com');

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99998 }}>
      
      {/* 1. Subtle, Non-Flashy Glassmorphic Round Button */}
      {!isExpanded && (
        <button
          type="button"
          onClick={() => {
            setIsExpanded(true);
            if (!isPlaying) setIsPlaying(true);
          }}
          title={isPlaying ? 'Music playing: ' + activeTrack.title + ' (Click to expand)' : 'Tendril Soundscapes (Click to open)'}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(18, 22, 32, 0.72)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.2s ease',
            color: isPlaying ? '#a8c7fa' : 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(25, 30, 45, 0.85)';
            e.currentTarget.style.borderColor = 'rgba(168, 199, 250, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(18, 22, 32, 0.72)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
          }}
        >
          {/* Subtle clean music icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
          
          {/* Tiny understated activity dot */}
          {isPlaying && (
            <span style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#a8c7fa',
              boxShadow: '0 0 4px #a8c7fa',
            }} />
          )}
        </button>
      )}

      {/* 2. Expanded Glassmorphic Player Card — The iframe inside NEVER unmounts */}
      <div
        className="in-app-music-card"
        style={{
          display: isExpanded ? 'block' : 'none',
          width: '380px',
          maxWidth: 'calc(100vw - 48px)',
          background: 'rgba(14, 18, 28, 0.88)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '18px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fade-up 0.2s ease-out',
        }}
      >
        {/* Top Header Bar */}
        <div style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: activeTrack.color || '#a8c7fa', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#e3e3e3',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {activeTrack.title}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                {activeTrack.moodLabel || 'Soundscape'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {/* Previous track */}
            <button
              type="button"
              onClick={handlePrevTrack}
              title="Previous station"
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                cursor: 'pointer', padding: '3px', borderRadius: '4px', display: 'flex'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="19 20 9 12 19 4 19 20"/>
                <line x1="5" y1="19" x2="5" y2="5"/>
              </svg>
            </button>

            {/* Next track */}
            <button
              type="button"
              onClick={handleNextTrack}
              title="Next station"
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                cursor: 'pointer', padding: '3px', borderRadius: '4px', display: 'flex'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 4 15 12 5 20 5 4"/>
                <line x1="19" y1="5" x2="19" y2="19"/>
              </svg>
            </button>

            {/* Change button */}
            <button
              type="button"
              onClick={() => setShowChangeModal(v => !v)}
              title="Change song or playlist"
              style={{
                background: showChangeModal ? 'rgba(168, 199, 250, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#c7d8ff',
                borderRadius: '9999px',
                padding: '2px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                marginLeft: '3px',
              }}
            >
              Change
            </button>

            {/* Minimize button (back into circle) */}
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              title="Minimize to round button"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '3px 4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                marginLeft: '2px',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </div>

        {/* Change / Search / Station Selector Drawer */}
        {showChangeModal && (
          <div style={{
            padding: '12px 14px',
            background: 'rgba(10, 14, 22, 0.95)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                Paste any YouTube song or playlist link:
              </span>
              <a
                href={youtubeWatchUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                YouTube ↗
              </a>
            </div>

            <form onSubmit={handleApplyCustomUrl} style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Paste YouTube link or playlist URL…"
                style={{
                  flex: 1,
                  padding: '5px 10px',
                  fontSize: '11.5px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: '#fff',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                className="btn-google-primary"
                style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '6px', whiteSpace: 'nowrap' }}
              >
                Play
              </button>
            </form>

            {/* Quick Stations Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
              {FEEL_SONGS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectTrack(s)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '9999px',
                    background: activeTrack.videoId === s.videoId ? 'rgba(168, 199, 250, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: activeTrack.videoId === s.videoId ? '1px solid #a8c7fa' : '1px solid var(--border-subtle)',
                    color: activeTrack.videoId === s.videoId ? '#a8c7fa' : 'var(--text-secondary)',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  {s.moodLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Embedded YouTube Player — NEVER unmounted, so audio continues without restart! */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '180px',
            background: '#000',
          }}
        >
          {isPlaying && (
            <iframe
              key={activeTrack.videoId || activeTrack.customUrl}
              width="100%"
              height="180"
              src={getEmbedUrl(activeTrack)}
              title={activeTrack.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ display: 'block', border: 'none' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

