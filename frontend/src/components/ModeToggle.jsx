export default function ModeToggle({ mode, onChange }) {
  return (
    <div className="mode-switcher-pill" style={{ marginBottom: '14px', width: 'fit-content' }}>
      <button
        className={`mode-pill-btn ${mode === 'text' ? 'active' : ''}`}
        onClick={() => onChange('text')}
      >
        <span>⌨️ Flow Text</span>
      </button>
      <button
        className={`mode-pill-btn ${mode === 'voice' ? 'active' : ''}`}
        onClick={() => onChange('voice')}
      >
        <span>🎙️ Ambient Voice</span>
      </button>
    </div>
  );
}
