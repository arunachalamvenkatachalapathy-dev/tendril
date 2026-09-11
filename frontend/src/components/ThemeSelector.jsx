import { useState, useRef, useEffect } from 'react';
import { THEMES } from '../theme.js';

export default function ThemeSelector({ currentTheme, onSelectTheme }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  const activeThemeObj = THEMES.find(t => t.id === currentTheme) || THEMES[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        title={`Theme Atmosphere: ${activeThemeObj.name}`}
        aria-label={`Theme: ${activeThemeObj.name}`}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isOpen ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: isOpen ? `1.5px solid ${activeThemeObj.accent}` : '1px solid var(--border-subtle)',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.2s ease',
          boxShadow: isOpen ? `0 0 10px ${activeThemeObj.accent}40` : 'none',
          userSelect: 'none',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.borderColor = activeThemeObj.accent;
          e.currentTarget.style.transform = 'scale(1.06)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = isOpen ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.borderColor = isOpen ? activeThemeObj.accent : 'var(--border-subtle)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {/* Aesthetic Color Object Swatch (No Words) */}
        <span
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: `conic-gradient(from 45deg, ${activeThemeObj.accent}, ${activeThemeObj.surfaceBg || '#1e1f20'}, ${activeThemeObj.accent})`,
            boxShadow: `0 0 8px ${activeThemeObj.accent}70`,
            border: '1.5px solid rgba(255, 255, 255, 0.3)',
            display: 'block',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 99999,
            width: '260px',
            background: 'rgba(18, 22, 34, 0.96)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid var(--border-medium)',
            borderRadius: '16px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.3)',
            padding: '12px',
            animation: 'fade-up 0.2s ease-out',
          }}
        >
          <div style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#f0f3f8' }}>
              Journal Atmosphere
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Curated aesthetic writing environments
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {THEMES.map((theme) => {
              const isSelected = currentTheme === theme.id;
              return (
                <div
                  key={theme.id}
                  onClick={() => {
                    onSelectTheme(theme.id);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    border: isSelected ? '1px solid ' + theme.accent + '40' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    {/* Swatch preview */}
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: theme.surfaceBg,
                      border: '2px solid ' + theme.accent,
                      boxShadow: isSelected ? '0 0 8px ' + theme.accent + '60' : 'none',
                      flexShrink: 0,
                    }} />

                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '12.5px',
                        fontWeight: isSelected ? '600' : '500',
                        color: isSelected ? '#fff' : '#d0d4dc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {theme.name}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        {theme.inspiration}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

