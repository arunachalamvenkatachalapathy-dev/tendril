import React from 'react';
import { useVoiceContext } from '../voice/VoiceContext.jsx';

export default function FloatingVoiceControls({ path, navigate, onOpenVoiceConvo, composerMode }) {
  const {
    micActive,
    toggleMic,
    status,
    audioLevel,
    currentSubtitle,
    liveTranscript,
    saveCurrentNote,
    savingNote,
    saveSuccessNotice,
    language,
    toggleLanguage,
  } = useVoiceContext();

  const isReflect = path === '/';

  const handleMicClick = () => {
    if (!micActive) {
      onOpenVoiceConvo?.();
      toggleMic();
    } else {
      toggleMic();
    }
  };

  const isUserSpeaking = micActive && (audioLevel > 12 || (currentSubtitle?.role === 'user' && currentSubtitle?.isLive));
  const isAssistantSpeaking = status === 'speaking' || (currentSubtitle?.role === 'assistant' && currentSubtitle?.isLive);
  const showLivePill = Boolean(currentSubtitle?.text) || isUserSpeaking || isAssistantSpeaking;

  return (
    <>
      <style>{`
        @keyframes micHaloPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(109, 213, 140, 0.6), 0 4px 16px rgba(0, 0, 0, 0.3);
          }
          70% {
            box-shadow: 0 0 0 14px rgba(109, 213, 140, 0), 0 4px 16px rgba(0, 0, 0, 0.3);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(109, 213, 140, 0), 0 4px 16px rgba(0, 0, 0, 0.3);
          }
        }

        @keyframes micWaveRipple {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
          }
        }

        .tendril-floating-mic {
          position: fixed;
          bottom: 76px;
          right: 24px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 99998;
          transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
          outline: none;
        }

        .tendril-floating-mic.active {
          background: rgba(22, 33, 49, 0.88);
          border: 1.5px solid rgba(109, 213, 140, 0.6);
          color: #6dd58c;
          animation: micHaloPulse 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .tendril-floating-mic.speaking {
          animation: micHaloPulse 1.2s infinite ease-out, micWaveRipple 0.8s infinite ease-in-out;
          border-color: #a8c7fa;
          color: #a8c7fa;
        }

        .tendril-floating-mic.inactive {
          background: rgba(26, 34, 48, 0.82);
          border: 1px solid rgba(168, 199, 250, 0.22);
          color: var(--text-secondary, #9aa0a6);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
        }

        .tendril-floating-mic:hover {
          transform: translateY(-2px) scale(1.05);
        }

        .tendril-floating-lang {
          position: fixed;
          bottom: 128px;
          right: 24px;
          height: 32px;
          padding: 0 10px;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(20, 27, 40, 0.88);
          border: 1px solid rgba(168, 199, 250, 0.25);
          color: #e3e3e3;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          z-index: 99998;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
          transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
          outline: none;
        }

        .tendril-floating-lang:hover {
          transform: translateY(-2px) scale(1.05);
          border-color: rgba(168, 199, 250, 0.45);
        }

        .tendril-live-transcript-pill {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          max-width: min(600px, 90vw);
          background: rgba(20, 27, 40, 0.92);
          border: 1px solid rgba(168, 199, 250, 0.25);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 9999px;
          padding: 8px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
          z-index: 99990;
          animation: fadeInSlideUp 0.25s ease-out;
        }

        @keyframes fadeInSlideUp {
          from {
            opacity: 0;
            transform: translate(-50%, 10px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        @media (max-width: 768px) {
          /* Default mobile stack on secondary screens (above 76px bottom dock) */
          .tendril-floating-mic {
            bottom: 132px !important;
            right: 16px !important;
          }
          .tendril-floating-lang {
            bottom: 180px !important;
            right: 16px !important;
          }
          .tendril-live-transcript-pill {
            bottom: 84px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            max-width: calc(100vw - 32px) !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45) !important;
          }

          /* On Reflect screen on mobile: stacked safely above the composer input bar */
          .tendril-floating-mic.on-reflect {
            bottom: 192px !important;
            right: 16px !important;
          }
          .tendril-floating-lang.on-reflect {
            bottom: 240px !important;
            right: 16px !important;
          }
          .tendril-live-transcript-pill.on-reflect {
            bottom: 144px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            max-width: calc(100vw - 32px) !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45) !important;
          }
        }
      `}</style>

      {/* Floating Language Toggle stacked above the mic button */}
      <button
        type="button"
        className={`tendril-floating-lang ${isReflect ? 'on-reflect' : ''}`}
        onClick={toggleLanguage}
        title={
          language === 'en'
            ? 'Speech recognition: English (Click for Multilingual)'
            : 'Speech recognition: Multilingual Auto-Detect (Click for English)'
        }
        aria-label="Toggle speech language"
      >
        <span style={{ fontSize: '12px' }}>{language === 'en' ? '🇺🇸' : '🌐'}</span>
        <span style={{ color: language === 'en' ? '#a8c7fa' : '#6dd58c' }}>
          {language === 'en' ? 'EN' : 'Multi'}
        </span>
      </button>

      {/* Floating Circular Mic Button stacked right above the floating music button */}
      <button
        type="button"
        className={`tendril-floating-mic ${
          isAssistantSpeaking ? 'speaking' : micActive ? 'active' : 'inactive'
        } ${isReflect ? 'on-reflect' : ''}`}
        onClick={handleMicClick}
        title={
          micActive
            ? 'Voice listening is active (Click to mute mic)'
            : 'Voice listening is muted (Click to start listening)'
        }
        aria-label="Toggle microphone"
      >
        {micActive ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      {/* Floating Live Subtitle Pill across all pages */}
      {showLivePill && (
        <div className={`tendril-live-transcript-pill ${isReflect ? 'on-reflect' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: currentSubtitle?.role === 'assistant' ? '#a8c7fa' : '#6dd58c',
                boxShadow:
                  currentSubtitle?.role === 'assistant'
                    ? '0 0 8px #a8c7fa'
                    : '0 0 8px #6dd58c',
              }}
            />
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: '600',
                color: currentSubtitle?.role === 'assistant' ? '#a8c7fa' : '#6dd58c',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
            >
              {currentSubtitle?.role === 'assistant' ? 'Gemini' : 'Listening'}
            </span>
          </div>

          <div
            style={{
              fontSize: '13px',
              color: '#e3e3e3',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '320px',
            }}
          >
            {currentSubtitle?.text || (isUserSpeaking ? 'Listening to you…' : '…')}
          </div>

          {/* Quick jump to Reflect if user is on Universe or Actions */}
          {path !== '/' && (
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                background: 'rgba(168, 199, 250, 0.12)',
                border: '1px solid rgba(168, 199, 250, 0.3)',
                color: '#a8c7fa',
                fontSize: '11.5px',
                fontWeight: '500',
                padding: '3px 10px',
                borderRadius: '9999px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              title="Open full conversation in Reflect"
            >
              Open Reflect
            </button>
          )}

          {/* Quick save button if conversation has user messages */}
          {liveTranscript.length > 0 && (
            <button
              type="button"
              onClick={saveCurrentNote}
              disabled={savingNote}
              style={{
                background: 'var(--accent-green, #6dd58c)',
                border: 'none',
                color: '#0e1e12',
                fontSize: '11.5px',
                fontWeight: '600',
                padding: '3px 10px',
                borderRadius: '9999px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              title="Save current reflection note"
            >
              {savingNote ? 'Saving…' : 'Save note'}
            </button>
          )}
        </div>
      )}

      {/* Save Success Toast */}
      {saveSuccessNotice && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(22, 45, 30, 0.95)',
            border: '1px solid rgba(109, 213, 140, 0.4)',
            color: '#6dd58c',
            padding: '8px 20px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: '500',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{saveSuccessNotice}</span>
        </div>
      )}
    </>
  );
}
