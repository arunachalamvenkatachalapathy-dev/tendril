export default function EntryDetail({ entry, onBack }) {
  if (!entry) return null;

  return (
    <section className="composer">
      <div className="composer-header">
        <h2>{entry.title}</h2>
        <button className="save-btn" onClick={onBack}>
          + New entry
        </button>
      </div>

      <div className="messages">
        <div className="msg assistant" style={{ maxWidth: '100%' }}>
          <strong>Summary:</strong> {entry.summary}
          <br />
          <br />
          <strong>Mood:</strong> {entry.mood}
          {entry.themes?.length > 0 && (
            <>
              <br />
              <strong>Themes:</strong> {entry.themes.join(', ')}
            </>
          )}
        </div>
        {(entry.messages || []).map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text}
          </div>
        ))}
      </div>
    </section>
  );
}
