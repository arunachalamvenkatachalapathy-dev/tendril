import { useState, useEffect } from 'react';

export const FEEL_SONGS = [
  {
    id: 'succession-focus',
    title: 'Succession & Cinematic Piano Playlist',
    artist: 'Nicholas Britell / Orchestral Continuous Stream',
    mood: 'energized',
    moodLabel: 'Cinematic & Drive',
    emoji: '🎻',
    color: '#a8c7fa',
    type: 'playlist',
    playlistId: 'PLdisKgV_W5Z9f1uK6n9A-jX-H8p6J7f0e',
    videoId: 'jZq3m2jN1oU',
    searchQuery: 'Succession OST and Cinematic Piano Playlist',
    description: 'Dramatic classical piano cadence and orchestral suites for deep determination and problem solving.',
  },
  {
    id: 'lofi-calm',
    title: 'Lofi Beats to Reflect & Journal Playlist',
    artist: 'Lofi Girl Official Continuous Playlist',
    mood: 'calm',
    moodLabel: 'Calm & Warm',
    emoji: '🌿',
    color: '#6dd58c',
    type: 'playlist',
    playlistId: 'PLofht4PTcKYnaH8w5olJCI-wUVxuoMHqM',
    videoId: 'jfKfP97GQzM',
    searchQuery: 'lofi hip hop radio beats to relax study to playlist',
    description: 'Cozy, gentle downtempo continuous beats to slow down mental chatter.',
  },
  {
    id: 'interstellar-space',
    title: 'Cosmic & Interstellar Ambient Playlist',
    artist: 'Hans Zimmer / Ambient Space Continuous Suite',
    mood: 'hopeful',
    moodLabel: 'Cosmic Reflection',
    emoji: '🌌',
    color: '#c58af9',
    type: 'playlist',
    playlistId: 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG',
    videoId: '45ETZ1CaVEw',
    searchQuery: 'Interstellar Soundtrack and Deep Space Ambient Playlist',
    description: 'Expansive ethereal soundscapes designed for cosmic reflection and perspective.',
  },
  {
    id: 'rain-piano',
    title: 'Peaceful Rain & Soft Piano Playlist',
    artist: 'Rainy Day Cafe & Classical Ambient Stream',
    mood: 'calm',
    moodLabel: 'Peaceful Rain',
    emoji: '🌧️',
    color: '#78a9ff',
    type: 'playlist',
    playlistId: 'PLQkQf10GEEwc4uH2W3s_j8B_m4S0y8Z4e',
    videoId: 'lTRiuFIWV54',
    searchQuery: 'Peaceful Piano and Gentle Rain Relaxation Playlist',
    description: 'Gentle raindrops with solitary piano melodies for introspection.',
  },
  {
    id: 'alpha-waves',
    title: 'Deep Focus & Flow State Playlist',
    artist: 'Brainwave Lab / Alpha & Theta Waves Continuous',
    mood: 'focused',
    moodLabel: 'Deep Flow',
    emoji: '🧠',
    color: '#fdd663',
    type: 'playlist',
    playlistId: 'PLr4V_hVkhWbW7Fq6j0H1jN5E69H5B6B4L',
    videoId: 'WPni755-Krg',
    searchQuery: 'Deep Focus Music Study Binaural Beats Alpha Waves Playlist',
    description: 'Binaural frequencies to sustain unbroken focus during writing or reflection.',
  },
  {
    id: 'morning-uplift',
    title: 'Acoustic Warmth & Gentle Sunrise Playlist',
    artist: 'Morning Acoustic Vibes & Coffeehouse Stream',
    mood: 'happy',
    moodLabel: 'Uplifting Clarity',
    emoji: '🌅',
    color: '#ffb74d',
    type: 'playlist',
    playlistId: 'PL3-sRm8xAzY9P_s2F1Q8A7D9k3f5g7h1j',
    videoId: 'WJ3-F02-U_g',
    searchQuery: 'Morning Acoustic Guitar Sunshine Relaxation Playlist',
    description: 'Bright, heartwarming acoustic picking to inspire optimism and clarity.',
  },
];

/**
 * Constructs a YouTube playlist embed URL
 */
export function getEmbedUrl(track) {
  if (!track) return '';
  if (track.playlistId) {
    return 'https://www.youtube-nocookie.com/embed/videoseries?list=' + track.playlistId + '&autoplay=1&enablejsapi=1&playsinline=1';
  }
  if (track.searchQuery) {
    return 'https://www.youtube-nocookie.com/embed?listType=search&list=' + encodeURIComponent(track.searchQuery) + '&autoplay=1&enablejsapi=1&playsinline=1';
  }
  if (track.videoId) {
    return 'https://www.youtube-nocookie.com/embed/' + track.videoId + '?autoplay=1&loop=1&playlist=' + track.videoId + '&enablejsapi=1&playsinline=1';
  }
  return 'https://www.youtube-nocookie.com/embed?listType=search&list=' + encodeURIComponent(track.title || 'ambient playlist') + '&autoplay=1&enablejsapi=1&playsinline=1';
}

/**
 * Global helper to play music in the app from anywhere
 */
export function playInAppMusic(trackOrQuery) {
  if (!trackOrQuery) return;
  let track = trackOrQuery;
  if (typeof trackOrQuery === 'string') {
    // Search query or track title
    const found = FEEL_SONGS.find(s => 
      s.title.toLowerCase().includes(trackOrQuery.toLowerCase()) ||
      s.mood.toLowerCase().includes(trackOrQuery.toLowerCase())
    );
    track = found || FEEL_SONGS[0];
  }
  window.dispatchEvent(new CustomEvent('tendril:playMusic', { detail: track }));
}

/**
 * Boards of Feel Songs component for the dashboard & reflection
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
          <span style={{ fontSize: '18px' }}>🎧</span>
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
          Click any board banner to stream music directly in Tendril
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
                    gap: '4px',
                  }}>
                    <span>{song.emoji}</span>
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
                  {isPlaying ? '● Playing Playlist in App' : '▶ Play Playlist'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Continuous Playlist
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
 * Floating / Docked In-App Music Player Banner
 */
export function InAppMusicPlayer({ track, onClose }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  if (!track) return null;

  return (
    <div
      className="in-app-music-banner"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99998,
        maxWidth: isMinimized ? '320px' : '440px',
        width: 'calc(100vw - 48px)',
        background: 'rgba(15, 18, 26, 0.95)',
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
          <span style={{ fontSize: '16px' }}>{track.emoji || '🎵'}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '12.5px',
              fontWeight: '600',
              color: '#e3e3e3',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {track.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Playing in Tendril • {track.moodLabel || 'Feel Songs'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Equalizer animation */}
          {isPlaying && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: '6px' }}>
              <span className="soundwave-bar bar-1" />
              <span className="soundwave-bar bar-2" />
              <span className="soundwave-bar bar-3" />
            </div>
          )}

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
          width="100%"
          height="180"
          src={getEmbedUrl(track)}
          title={track.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ display: 'block', border: 'none' }}
        />
      </div>
    </div>
  );
}
