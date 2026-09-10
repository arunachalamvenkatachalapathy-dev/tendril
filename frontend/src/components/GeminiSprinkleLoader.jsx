import React from 'react';

/**
 * GeminiSprinkleLoader
 * 
 * Implements the user's requested 'sprinkle or rotate' loading animation:
 * - Rotating, glowing Gemini 4-pointed diamond star
 * - Dynamic orbiting sprinkle sparkles (gold, emerald, violet, cyan, diamond)
 *   that twinkle, scale, and cast colorful glows
 */
export default function GeminiSprinkleLoader({
  size = 32,
  label = null,
  sublabel = null,
  inline = false,
  style = {},
}) {
  const starSize = Math.round(size * 0.72);

  return (
    <div
      className={`gemini-loader-container ${inline ? 'gemini-loader-inline' : ''}`}
      style={{
        display: inline ? 'inline-flex' : 'flex',
        flexDirection: inline ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: inline ? '10px' : '14px',
        textAlign: 'center',
        ...style,
      }}
    >
      <div
        className="gemini-sprinkle-stage"
        style={{
          position: 'relative',
          width: `${size}px`,
          height: `${size}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {/* Central Rotating & Breathing Gemini Star */}
        <svg
          className="gemini-rotate-star"
          width={starSize}
          height={starSize}
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{
            color: '#a8c7fa',
          }}
        >
          <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z" />
        </svg>

        {/* Orbiting Sprinkle Sparkles Ring */}
        <div
          className="gemini-sprinkle-ring"
          style={{
            position: 'absolute',
            inset: '-6px',
            pointerEvents: 'none',
          }}
        >
          {/* Gold Sparkle */}
          <span
            className="sprinkle-dot dot-gold"
            style={{
              position: 'absolute',
              top: '0px',
              right: '4px',
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#fdd663',
              boxShadow: '0 0 8px #fdd663',
            }}
          />
          {/* Emerald Sparkle */}
          <span
            className="sprinkle-dot dot-emerald"
            style={{
              position: 'absolute',
              bottom: '2px',
              right: '2px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: '#6dd58c',
              boxShadow: '0 0 8px #6dd58c',
            }}
          />
          {/* Violet Sparkle */}
          <span
            className="sprinkle-dot dot-violet"
            style={{
              position: 'absolute',
              bottom: '0px',
              left: '4px',
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#c58af9',
              boxShadow: '0 0 8px #c58af9',
            }}
          />
          {/* Blue Sparkle */}
          <span
            className="sprinkle-dot dot-blue"
            style={{
              position: 'absolute',
              top: '2px',
              left: '2px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: '#78d9ec',
              boxShadow: '0 0 8px #78d9ec',
            }}
          />
          {/* Tiny Diamond Center-Right */}
          <span
            className="sprinkle-dot dot-diamond"
            style={{
              position: 'absolute',
              top: '50%',
              right: '-4px',
              transform: 'translateY(-50%) rotate(45deg)',
              width: '3.5px',
              height: '3.5px',
              background: '#ffffff',
              boxShadow: '0 0 6px #ffffff',
            }}
          />
        </div>
      </div>

      {(label || sublabel) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {label && (
            <div
              style={{
                color: '#e3e3e3',
                fontSize: inline ? '13.5px' : '15px',
                fontWeight: '500',
                letterSpacing: '-0.01em',
              }}
            >
              {label}
            </div>
          )}
          {sublabel && (
            <div
              style={{
                color: 'var(--text-secondary)',
                fontSize: '13px',
                lineHeight: '1.45',
              }}
            >
              {sublabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}