import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export const FEEL_SONGS = [
  {
    id: 'succession-lofi',
    title: 'Succession Main Theme (Lofi Remix)',
    artist: 'Nicholas Britell / Lofi Chill',
    mood: 'focused',
    moodLabel: 'Succession Lofi',
    color: '#a8c7fa',
    videoId: 'mAtdSyadnZU',
    description: 'Moody, iconic piano chords with chilled lofi beats for introspective deep work.',
  },
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
    id: 'dynamic-playlist',
    title: 'Dynamic Chill & Study Stream',
    artist: 'Continuous Dynamic Flow',
    mood: 'focused',
    moodLabel: 'Dynamic Playlist',
    color: '#c58af9',
    playlistId: 'UUyD54nsDZ928JJu3Kbm7Fig',
    description: 'Continuously updating multi-track dynamic ambient stream for effortless focus.',
  },
  {
    id: 'sitar-focus',
    title: 'Sitar For A Focused Mind',
    artist: 'Indian Meditation Music / Deep Focus',
    mood: 'focused',
    moodLabel: 'Sitar Meditation',
    color: '#ffb74d',
    videoId: 'kvi75cdKk18',
    description: 'Traditional Indian sitar meditation music for deep contemplative reflection and unbroken flow state.',
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
  if (!trimmed) return null;

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

  // 6. Otherwise treat as a search query
  return { type: 'search', id: trimmed };
}

/**
 * Constructs a verified embed URL
 */
export function getEmbedUrl(track) {
  if (!track) return '';
  const originParam = typeof window !== 'undefined' && window.location.origin
    ? '&origin=' + encodeURIComponent(window.location.origin)
    : '';

  if (track.searchQuery) {
    return 'https://www.youtube.com/embed?listType=search&list=' + encodeURIComponent(track.searchQuery) + '&autoplay=1&enablejsapi=1&playsinline=1&loop=1&rel=0' + originParam;
  }

  if (track.customUrl) {
    const parsed = parseYouTubeInput(track.customUrl);
    if (parsed) {
      if (parsed.type === 'playlist') {
        return 'https://www.youtube.com/embed/videoseries?list=' + parsed.id + '&autoplay=1&enablejsapi=1&playsinline=1&loop=1&rel=0' + originParam;
      }
      if (parsed.type === 'video') {
        return 'https://www.youtube.com/embed/' + parsed.id + '?autoplay=1&enablejsapi=1&playsinline=1&loop=1&playlist=' + parsed.id + '&rel=0' + originParam;
      }
      if (parsed.type === 'search') {
        return 'https://www.youtube.com/embed?listType=search&list=' + encodeURIComponent(parsed.id) + '&autoplay=1&enablejsapi=1&playsinline=1&loop=1&rel=0' + originParam;
      }
    }
  }

  if (track.playlistId) {
    return 'https://www.youtube.com/embed/videoseries?list=' + track.playlistId + '&autoplay=1&enablejsapi=1&playsinline=1&loop=1&rel=0' + originParam;
  }

  const vId = track.videoId || 'mAtdSyadnZU';
  return 'https://www.youtube.com/embed/' + vId + '?autoplay=1&enablejsapi=1&playsinline=1&loop=1&playlist=' + vId + '&rel=0' + originParam;
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
    const saved = localStorage.getItem('tendril_last_track_v25');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.videoId || parsed.playlistId || parsed.customUrl || parsed.searchQuery)) return parsed;
    }
  } catch (e) {}
  return FEEL_SONGS[0]; // Succession Main Theme (Lofi Remix)
}

/**
 * Floating In-App Music Widget
 * - Subtle, calm, non-flashy 40px round glass button.
 * - Single persistent iframe that NEVER pauses or restarts when clicking the round button.
 * - 25% default volume with interactive top-bar volume changer and slider.
 * - Succession Main Theme (Lofi Remix) default track for all users.
 * - Real-time Song Search & YouTube audio stream search.
 */
export function InAppMusicPlayer({ track }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showVolumeModal, setShowVolumeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTrack, setActiveTrack] = useState(() => getInitialTrack(track));
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(() => {
    try {
      const saved = localStorage.getItem('tendril_music_volume_v10');
      if (saved !== null) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 0 && val <= 100) return val;
      }
    } catch (e) {}
    return 10; // 10 percent default (final confirmed)
  });
  const [duckState, setDuckState] = useState({
    isSpeaking: false,
    userSpeaking: false,
    assistantSpeaking: false,
  });
  const iframeRef = useRef(null);
  const widgetRef = useRef(null);

  // Dynamic Audio Ducking for Convo Mode:
  // - When user speaks: volume moves to 0% (complete silence for mic clarity)
  // - When Gemini / Convo relays/replies: volume moves to 5% (soft ambient backing track)
  // - When idle: volume returns to user's independent volume setting (e.g. 10% default or whatever user set)
  // - Music preference in localStorage is completely independent and preserved.
  useEffect(() => {
    const handleVoiceSpeaking = (e) => {
      const d = e?.detail || {};
      setDuckState({
        isSpeaking: Boolean(d.isSpeaking),
        userSpeaking: Boolean(d.userSpeaking),
        assistantSpeaking: Boolean(d.assistantSpeaking),
      });
    };

    window.addEventListener('tendril:voice-speaking', handleVoiceSpeaking);
    return () => {
      window.removeEventListener('tendril:voice-speaking', handleVoiceSpeaking);
    };
  }, []);

  // Effective volume sent to YouTube player: ducked to 0% if user speaking, 5% if assistant relaying, else user volume
  const effectiveVolume = duckState.userSpeaking
    ? 0
    : duckState.assistantSpeaking
    ? Math.min(volume, 5)
    : volume;

  // Sync track when external event fires
  useEffect(() => {
    if (track) {
      setActiveTrack(track);
      setIsPlaying(true);
      try {
        localStorage.setItem('tendril_last_track_v25', JSON.stringify(track));
      } catch (e) {}
    }
  }, [track]);

  // Persist volume preference
  useEffect(() => {
    try {
      localStorage.setItem('tendril_music_volume_v10', volume.toString());
    } catch (e) {}
  }, [volume]);

  // When player is open, clicking anywhere in the rest of the screen collapses it back to the round circle
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) {
        setIsExpanded(false);
        setShowSearchModal(false);
        setShowVolumeModal(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isExpanded]);

  // Auto-minimize player card back to the round button after 15 seconds of inactivity
  useEffect(() => {
    if (!isExpanded) return;
    let timer = null;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setIsExpanded(false);
        setShowSearchModal(false);
        setShowVolumeModal(false);
      }, 15000);
    };
    resetTimer();
    const events = ['mousemove', 'pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [isExpanded]);

  const sendIframeCommand = useCallback((func, args = []) => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      }
    } catch (e) {}
  }, []);

  const startPlayback = useCallback(() => {
    sendIframeCommand('unMute');
    sendIframeCommand('setVolume', [effectiveVolume]);
    sendIframeCommand('playVideo');
  }, [sendIframeCommand, effectiveVolume]);

  const handleTogglePlayPause = useCallback(() => {
    if (isPlaying) {
      sendIframeCommand('pauseVideo');
      setIsPlaying(false);
    } else {
      startPlayback();
      setIsPlaying(true);
    }
  }, [isPlaying, startPlayback]);

  // Enforce automatic ambient playback whenever iframe loads
  const handleIframeLoad = useCallback(() => {
    startPlayback();
    setTimeout(startPlayback, 250);
    setTimeout(startPlayback, 700);
    setTimeout(startPlayback, 1500);
    setTimeout(startPlayback, 3000);
  }, [startPlayback]);

  useEffect(() => {
    sendIframeCommand('setVolume', [effectiveVolume]);
  }, [effectiveVolume, sendIframeCommand]);

  // Listen to YouTube player ready event to start playback immediately & loop on end
  useEffect(() => {
    const onWindowMessage = (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!data) return;

        if (data.event === 'onReady' || data.event === 'initialDelivery') {
          startPlayback();
        }

        if (data.event === 'onStateChange') {
          if (data.info === 1) {
            setIsPlaying(true);
          } else if (data.info === 2) {
            setIsPlaying(false);
          } else if (data.info === -1) {
            startPlayback();
          } else if (data.info === 0) {
            // When a video ends (info === 0: YT.PlayerState.ENDED),
            // loop immediately inside the player to prevent end screen links from opening in a new tab!
            sendIframeCommand('seekTo', [0, true]);
            sendIframeCommand('playVideo');
            sendIframeCommand('unMute');
            sendIframeCommand('setVolume', [effectiveVolume]);
            setIsPlaying(true);
          }
        }
      } catch (err) {}
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [sendIframeCommand, effectiveVolume, startPlayback]);

  // Automatic unlock & resume on ANY user gesture anywhere on window (capture phase)
  useEffect(() => {
    let fired = false;
    const unlockAndPlay = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') ctx.resume();
        }
      } catch (e) {}

      startPlayback();

      if (!fired) {
        fired = true;
        setTimeout(startPlayback, 150);
        setTimeout(startPlayback, 600);
      }
    };

    const interactionEvents = [
      'pointerdown',
      'click',
      'touchstart',
      'keydown',
      'wheel',
      'scroll',
    ];

    interactionEvents.forEach((ev) => {
      window.addEventListener(ev, unlockAndPlay, { capture: true, passive: true });
    });

    return () => {
      interactionEvents.forEach((ev) => {
        window.removeEventListener(ev, unlockAndPlay, { capture: true });
      });
    };
  }, [startPlayback]);

  function handleSelectTrack(newTrack) {
    setActiveTrack(newTrack);
    setIsPlaying(true);
    setShowSearchModal(false);
    setShowVolumeModal(false);
    try {
      localStorage.setItem('tendril_last_track_v25', JSON.stringify(newTrack));
    } catch (e) {}
  }

  // Filter songs based on search query
  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return FEEL_SONGS;
    return FEEL_SONGS.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.artist && s.artist.toLowerCase().includes(q)) ||
      (s.moodLabel && s.moodLabel.toLowerCase().includes(q)) ||
      (s.description && s.description.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Search submit: supports matching tracks, YouTube URLs, or direct YouTube search stream
  function handleSearchSubmit(e, overrideQuery) {
    e?.preventDefault();
    const q = (overrideQuery || searchQuery).trim();
    if (!q) return;

    const parsed = parseYouTubeInput(q);
    if (parsed.type === 'video') {
      handleSelectTrack({
        id: 'yt-vid-' + Date.now(),
        title: 'Custom YouTube Stream',
        artist: 'YouTube Video',
        videoId: parsed.id,
        moodLabel: 'Custom Video',
        color: '#a8c7fa',
      });
    } else if (parsed.type === 'playlist') {
      handleSelectTrack({
        id: 'yt-list-' + Date.now(),
        title: 'Custom YouTube Playlist',
        artist: 'YouTube Stream',
        playlistId: parsed.id,
        moodLabel: 'Custom Playlist',
        color: '#c58af9',
      });
    } else {
      if (filteredSongs.length === 1 && !overrideQuery) {
        handleSelectTrack(filteredSongs[0]);
        return;
      }
      handleSelectTrack({
        id: 'search-' + Date.now(),
        title: `Search: "${q}"`,
        artist: 'YouTube Continuous Audio',
        searchQuery: q,
        moodLabel: 'Search Result',
        color: '#ffb74d',
        description: `Streaming top audio results for "${q}"`,
      });
    }
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

  // Memoize embed URL so it is never recomputed unnecessarily
  const embedUrl = useMemo(() => getEmbedUrl(activeTrack), [activeTrack]);
  const youtubeWatchUrl = activeTrack.customUrl || (activeTrack.videoId ? 'https://www.youtube.com/watch?v=' + activeTrack.videoId : 'https://www.youtube.com');

  return (
    <div ref={widgetRef} style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99998 }}>
      
      {/* 1. Subtle, Non-Flashy Glassmorphic Round Button (always present, never flashy) */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        title={isPlaying ? 'Tendril Music: ' + activeTrack.title + ' (' + volume + '% volume)' : 'Tendril Ambient Soundscapes'}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: isExpanded ? 'rgba(28, 34, 48, 0.92)' : 'rgba(18, 22, 32, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: isExpanded ? '1px solid #a8c7fa' : '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.2s ease',
          color: isPlaying ? '#a8c7fa' : 'var(--text-secondary)',
          zIndex: 99999,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(28, 34, 52, 0.95)';
          e.currentTarget.style.borderColor = 'rgba(168, 199, 250, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isExpanded ? 'rgba(28, 34, 48, 0.92)' : 'rgba(18, 22, 32, 0.85)';
          e.currentTarget.style.borderColor = isExpanded ? '#a8c7fa' : 'rgba(255, 255, 255, 0.14)';
        }}
      >
        {/* Subtle clean music icon */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
        
        {/* Understated ambient listening dot (no flashy pulsing) */}
        {isPlaying && (
          <span style={{
            position: 'absolute',
            top: '7px',
            right: '7px',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: '#a8c7fa',
          }} />
        )}
      </button>

      {/* 2. Expanded Glassmorphic Player Card
          Placed directly above the round button at bottom: 74px.
          CRITICAL: NEVER use display: none or visibility: hidden!
          Using opacity + pointerEvents preserves the iframe in memory,
          so audio CONTINUES UNINTERRUPTED and NEVER RESTARTS when clicking the round button! */}
      <div
        className="in-app-music-card"
        style={{
          position: 'fixed',
          bottom: '74px',
          right: '24px',
          zIndex: 99998,
          width: '380px',
          maxWidth: 'calc(100vw - 48px)',
          background: 'rgba(14, 18, 28, 0.92)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: isExpanded ? 1 : 0,
          transform: isExpanded ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
          pointerEvents: isExpanded ? 'auto' : 'none',
        }}
      >
        {/* Top Header Bar */}
        <div style={{
          padding: '9px 12px',
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
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {activeTrack.moodLabel || 'Ambient'} • {isDucked ? '5% (Ducked for Convo)' : `${volume}% volume`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            {/* Play / Pause button */}
            <button
              type="button"
              onClick={handleTogglePlayPause}
              title={isPlaying ? "Pause music" : "Play music"}
              style={{
                background: 'transparent',
                border: 'none',
                color: isPlaying ? '#a8c7fa' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '3px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            {/* Previous station */}
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

            {/* Next station */}
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

            {/* Song Search button in top bar */}
            <button
              type="button"
              onClick={() => {
                setShowSearchModal(v => !v);
                setShowVolumeModal(false);
              }}
              title="Search songs, artists, moods, or YouTube"
              style={{
                background: showSearchModal ? 'rgba(168, 199, 250, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#c7d8ff',
                borderRadius: '9999px',
                padding: '2px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Search</span>
            </button>

            {/* Volume Change button in the top of the YouTube bar */}
            <button
              type="button"
              onClick={() => {
                setShowVolumeModal(v => !v);
                setShowSearchModal(false);
              }}
              title={isDucked ? `Volume: ${volume}% (ducked to 5% during convo speech)` : "Adjust volume (Default: 10%)"}
              style={{
                background: showVolumeModal ? 'rgba(168, 199, 250, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: isDucked ? '1px solid #fdd663' : '1px solid rgba(255, 255, 255, 0.1)',
                color: isDucked ? '#fdd663' : '#c7d8ff',
                borderRadius: '9999px',
                padding: '2px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              <span>{isDucked ? '5%' : `${volume}%`}</span>
            </button>

            {/* Minimize / Down Arrow button */}
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
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dedicated Volume Control Drawer in Top Bar */}
        {showVolumeModal && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(10, 14, 22, 0.96)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
                <span style={{ fontSize: '11px', color: '#e3e3e3', fontWeight: '500' }}>
                  Volume: {volume}% {volume === 10 ? '(Default)' : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setVolume(v => (v === 0 ? 10 : 0))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '10.5px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {volume === 0 ? 'Unmute' : 'Mute'}
              </button>
            </div>

            {/* Continuous Volume Range Slider */}
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#a8c7fa',
                cursor: 'pointer',
                height: '4px',
              }}
            />

            {/* Quick preset chips */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              {[
                { val: 10, label: '10% Default' },
                { val: 25, label: '25% Whisper' },
                { val: 50, label: '50% Ambient' },
                { val: 80, label: '80% Rich' },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setVolume(p.val)}
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    padding: '3px 4px',
                    borderRadius: '4px',
                    background: volume === p.val ? 'rgba(168, 199, 250, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: volume === p.val ? '1px solid #a8c7fa' : '1px solid var(--border-subtle)',
                    color: volume === p.val ? '#a8c7fa' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dedicated Song Search Drawer */}
        {showSearchModal && (
          <div style={{
            padding: '12px 14px',
            background: 'rgba(10, 14, 22, 0.96)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '9px',
            maxHeight: '340px',
            overflowY: 'auto',
          }}>
            {/* Search Input Form */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px' }}>
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '0 8px',
                gap: '6px',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search songs, artists, moods, or YouTube..."
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: '11.5px',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      fontSize: '11px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="btn-google-primary"
                style={{ padding: '0 12px', fontSize: '11px', borderRadius: '8px', whiteSpace: 'nowrap' }}
              >
                Play
              </button>
            </form>

            {/* Direct YouTube search stream card if user is searching */}
            {searchQuery.trim() && (
              <div
                onClick={(e) => handleSearchSubmit(e, searchQuery.trim())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: 'rgba(168, 199, 250, 0.08)',
                  border: '1px solid rgba(168, 199, 250, 0.25)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '11.5px', fontWeight: '600', color: '#a8c7fa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Search YouTube & Play: "{searchQuery.trim()}"
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Continuous stream in player • Stays inside app
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#a8c7fa', fontWeight: '600', marginLeft: '6px' }}>▶</span>
              </div>
            )}

            {/* Curated or Filtered Tracks */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                {searchQuery.trim() ? `Matching Soundscapes (${filteredSongs.length})` : 'Curated Ambient Stations'}
              </div>

              {filteredSongs.length === 0 && !searchQuery.trim() && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '4px 0' }}>
                  No curated tracks found. Press Play above to search YouTube.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {filteredSongs.map((s) => {
                  const isCurrent = activeTrack.videoId === s.videoId || (s.playlistId && activeTrack.playlistId === s.playlistId);
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectTrack(s)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        background: isCurrent ? 'rgba(168, 199, 250, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isCurrent ? '1px solid rgba(168, 199, 250, 0.35)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '11.5px', fontWeight: isCurrent ? '600' : '500', color: isCurrent ? '#fff' : '#e0e4ec', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.title}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {s.artist}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '9.5px',
                        padding: '2px 6px',
                        borderRadius: '9999px',
                        background: isCurrent ? 'rgba(168, 199, 250, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        color: isCurrent ? '#a8c7fa' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        marginLeft: '6px',
                      }}>
                        {s.moodLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick volume reminder in search drawer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                Volume: {volume}% {volume === 10 ? '(Default)' : ''}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[10, 25, 50, 80].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVolume(v)}
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: volume === v ? 'rgba(168, 199, 250, 0.2)' : 'rgba(255,255,255,0.04)',
                      border: volume === v ? '1px solid #a8c7fa' : '1px solid transparent',
                      color: volume === v ? '#a8c7fa' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {v === 10 ? '10% (Default)' : v + '%'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick Station Selector Bar — Always available directly above the video for 1-click in-player track changes */}
        <div style={{
          padding: '6px 10px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {FEEL_SONGS.map((s) => {
            const isActive = activeTrack.videoId === s.videoId || activeTrack.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectTrack(s)}
                title={`Play ${s.title} in player`}
                style={{
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: isActive ? 'rgba(168, 199, 250, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                  border: isActive ? '1px solid #a8c7fa' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: isActive ? '#a8c7fa' : 'var(--text-secondary)',
                  fontSize: '10.5px',
                  fontWeight: isActive ? '600' : '400',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {isActive && <span style={{ marginRight: '4px' }}>●</span>}
                {s.moodLabel}
              </button>
            );
          })}
        </div>

        {/* Embedded YouTube Player — NEVER unmounted, loops in-player without external new-tab redirects */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '180px',
            background: '#000',
          }}
        >
          <iframe
            ref={iframeRef}
            onLoad={handleIframeLoad}
            width="100%"
            height="180"
            src={embedUrl}
            title={activeTrack.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ display: 'block', border: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}

