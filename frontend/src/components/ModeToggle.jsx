export default function ModeToggle({ mode, onChange }) {
  return (
    <div className="google-mode-pill" style={{ marginBottom: '14px', width: 'fit-content' }}>
      <button
        className={`google-mode-btn ${mode === 'text' ? 'active' : ''}`}
        onClick={() => onChange('text')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        <span>Write</span>
      </button>
      <button
        className={`google-mode-btn ${mode === 'voice' ? 'active' : ''}`}
        onClick={() => onChange('voice')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
        <span>Voice with Gemini</span>
      </button>
    </div>
  );
}
