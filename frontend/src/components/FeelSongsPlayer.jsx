import { useState, useEffect } from 'react';

export const FEEL_SONGS = [
  {
    id: 'succession-focus',
    title: 'Succession & Cinematic Piano',
    artist: 'Nicholas Britell / Orchestral Stream',
    mood: 'energized',
    moodLabel: 'Cinematic & Drive',
    color: '#a8c7fa',
    videoId: 'jZq3m2jN1oU',
    description: 'Dramatic classical piano cadence and orchestral suites for intense problem solving.',
  },
  {
    id: 'lofi-calm',
    title: 'Lofi Beats to Reflect & Journal',
    artist: 'Lofi Girl Continuous Live Stream',
    mood: 'calm',
    moodLabel: 'Calm & Warm',
    color: '#6dd58c',
    videoId: 'jfKfP97GQzM',
    description: 'Cozy, gentle downtempo continuous stream to quiet mental chatter.',
  },
  {
    id: 'interstellar-space',
    title: 'Cosmic & Interstellar Ambient',
    artist: 'Hans Zimmer / Deep Space Ambient',
    mood: 'hopeful',
    moodLabel: 'Cosmic Reflection',
    color: '#c58af9',
    videoId: '45ETZ1CaVEw',
    description: 'Expansive ethereal soundscapes designed for cosmic reflection and perspective.',
  },
  {
    id: 'rain-piano',
    title: 'Peaceful Rain & Soft Piano',
    artist: 'Rainy Day Cafe & Classical Ambient',
    mood: 'calm',
    moodLabel: 'Peaceful Rain',
    color: '#78a9ff',
    videoId: 'lTRiuFIWV54',
    description: 'Continuous soothing raindrops paired with solitary piano melodies for introspection.',
  },
  {
    id: 'alpha-waves',
    title: 'Deep Focus & Flow State',
    artist: 'Brainwave Lab / Alpha Waves Stream',
    mood: 'focused',
    moodLabel: 'Deep Flow',
    color: '#fdd663',
    videoId: 'WPni755-Krg',
    description: 'Continuous binaural frequencies to sustain unbroken focus during writing or reflection.',
  },
  {
    id: 'morning-uplift',
    title: 'Acoustic Warmth & Gentle Sunrise',
    artist: 'Morning Acoustic Vibes & Coffeehouse',
    mood: 'happy',
    moodLabel: 'Uplifting Clarity',
    color: '#ffb74d',
    videoId: 'WJ3-F02-U_g',
    description: 'Bright, heartwarming acoustic picking to inspire optimism and clarity.',
  },
];

/**
 * Extracts a YouTube Video ID or Playlist ID from any URL or raw string
 */
export function parseYouTubeInput(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. Check for playlist URL
  const listMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (listMatch) {
    return { type: 'playlist', id: listMatch[1] };
  }

  // 2. Check for standard YouTube watch URL: v=...
  const vMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (vMatch) {
    return { type: 'video', id: vMatch[1] };
  }

  // 3. Check for short link: youtu.be/...
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) {
    return { type: 'video', id: shortMatch[1] };
  }

  // 4. Check for embed link: /embed/...
  const embedMatch = trimmed.match(/\/embed\/([a-zA-Z0-9_-]+)/);
  if (embedMatch) {
    return { type: embedMatch[1].startsWith('PL') ? 'playlist' : 'video', id: embedMatch[1] };
  }

  // 5. If it's a raw 11-char video ID or raw PL playlist ID
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

  // Custom user-pasted URL or ID
  if (track.customUrl) {
    const parsed = parseYouTubeInput(track.customUrl);
    if (parsed) {
      if (parsed.type === 'playlist') {
        return 'https://www.youtube-nocookie.com/embed/videoseries?list=' + parsed.id + '&autoplay=1&enablejsapi=1&playsinline=1';
      }
      return 'https://www.youtube-nocookie.com/embed/' + parsed.id + '?autoplay=1&loop=1&playlist=' + parsed.id + '&enablejsapi=1&playsinline=1';
    }
  }

  if (track.playlistId) {
    return 'https://www.youtube-nocookie.com/embed/videoseries?list=' + track.playlistId + '&autoplay=1&enablejsapi=1&playsinline=1';
  }

  const vId = track.videoId || 'jfKfP97GQzM';
  return 'https://www.youtube-nocookie.com/embed/' + vId + '?autoplay=1&loop=1&playlist=' + vId + '&enablejsapi=1&playsinline=1';
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
      s.mood.toLowerCase().includes(trackOrQuery.toLowerCase())
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <span className="soundwave-bar bar-1" />
                      <span className="soundwave-bar bar-2" />
                      <span className="soundwave-bar bar-3" />
                    </div>
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
 * In-App Music Player Banner with Change Link Option
 */
export function InAppMusicPlayer({ track, onClose }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [activeTrack, setActiveTrack] = useState(track);

  useEffect(() => {
    if (track) setActiveTrack(track);
  }, [track]);

  if (!activeTrack) return null;

  function handleApplyCustomUrl(e) {
    e?.preventDefault();
    if (!customInput.trim()) return;
    const parsed = parseYouTubeInput(customInput.trim());
    if (!parsed) return;

    const newTrack = {
      ...activeTrack,
      id: 'custom-' + Date.now(),
      title: 'Custom YouTube Stream',
      artist: 'User Link',
      customUrl: customInput.trim(),
      videoId: parsed.type === 'video' ? parsed.id : null,
      playlistId: parsed.type === 'playlist' ? parsed.id : null,
      moodLabel: 'Custom Music',
    };
    setActiveTrack(newTrack);
    setShowChangeModal(false);
    setCustomInput('');
  }

  function handleSelectPreset(preset) {
    setActiveTrack(preset);
    setShowChangeModal(false);
  }

  return (
    <div
      className="in-app-music-banner"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99998,
        maxWidth: isMinimized ? '340px' : '460px',
        width: 'calc(100vw - 48px)',
        background: 'rgba(15, 18, 26, 0.96)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(168, 199, 250, 0.3)',
        borderRadius: '16px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65), 0 0 20px rgba(66, 133, 244, 0.25)',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        animation: 'fade-up 0.3s ease-out',
      }}
    >
      {/* Top Banner Control Bar */}
      <div style={{
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.04)',
        borderBottom: isMinimized ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '12.5px',
              fontWeight: '600',
              color: '#e3e3e3',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {activeTrack.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Playing in Tendril • {activeTrack.moodLabel || 'Feel Songs'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Change Track / Custom URL Button */}
          <button
            onClick={() => setShowChangeModal(v => !v)}
            title="Change music or paste any YouTube URL"
            style={{
              background: showChangeModal ? 'rgba(168, 199, 250, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(168, 199, 250, 0.3)',
              color: '#c7d8ff',
              borderRadius: '9999px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>Change</span>
          </button>

          {/* Equalizer animation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px', marginRight: '4px' }}>
            <span className="soundwave-bar bar-1" />
            <span className="soundwave-bar bar-2" />
            <span className="soundwave-bar bar-3" />
          </div>

          {/* Minimize / Expand Toggle */}
          <button
            onClick={() => setIsMinimized(v => !v)}
            title={isMinimized ? 'Expand player' : 'Minimize player'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isMinimized ? (
                <polyline points="18 15 12 9 6 15" />
              ) : (
                <polyline points="6 9 12 15 18 9" />
              )}
            </svg>
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            title="Close music player"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Change Music Input Dropdown Form */}
      {showChangeModal && (
        <div style={{
          padding: '12px 14px',
          background: '#121622',
          borderBottom: '1px solid rgba(168, 199, 250, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ fontSize: '11.5px', color: '#a8c7fa', fontWeight: '500' }}>
            Paste any YouTube video or playlist link:
          </div>
          <form onSubmit={handleApplyCustomUrl} style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or playlist ID"
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '12px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#fff',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              className="btn-google-primary"
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', whiteSpace: 'nowrap' }}
            >
              Play Link
            </button>
          </form>

          {/* Quick Preset Selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' }}>
            {FEEL_SONGS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectPreset(s)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '9999px',
                  background: activeTrack.id === s.id ? 'rgba(168, 199, 250, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: activeTrack.id === s.id ? '1px solid #a8c7fa' : '1px solid var(--border-subtle)',
                  color: activeTrack.id === s.id ? '#a8c7fa' : 'var(--text-secondary)',
                  fontSize: '10.5px',
                  cursor: 'pointer',
                }}
              >
                {s.title.split('&')[0].trim()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Embedded YouTube Player — NEVER unmounted so audio runs continuously until app is closed */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: isMinimized ? '0px' : '180px',
          background: '#000',
          overflow: 'hidden',
          transition: 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: isMinimized ? 0 : 1,
          pointerEvents: isMinimized ? 'none' : 'auto',
        }}
      >
        <iframe
          key={activeTrack.id || activeTrack.videoId || activeTrack.customUrl}
          width="100%"
          height="180"
          src={getEmbedUrl(activeTrack)}
          title={activeTrack.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ display: 'block', border: 'none' }}
        />
      </div>
    </div>
  );
}

