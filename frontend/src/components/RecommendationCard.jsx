import { playInAppMusic } from './FeelSongsPlayer.jsx';

export default function RecommendationCard({ recommendation }) {
  if (!recommendation) return null;

  const { message, links } = recommendation;
  const hasLinks = links && (links.youtubeMusic || links.maps || links.search);

  function handleMusicClick(e) {
    e.preventDefault();
    playInAppMusic(message || 'ambient');
  }

  return (
    <div className="recommendation-card">
      <p>{message}</p>
      {hasLinks && (
        <div className="recommendation-links">
          {links.youtubeMusic && (
            <button
              onClick={handleMusicClick}
              className="btn-google-secondary"
              style={{
                fontSize: '12px',
                padding: '4px 12px',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#a8c7fa',
                background: 'rgba(168, 199, 250, 0.1)',
                border: '1px solid rgba(168, 199, 250, 0.25)',
                cursor: 'pointer',
              }}
              title="Play recommended feel song directly in Tendril"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span>Play in App (YouTube Music)</span>
            </button>
          )}
          {links.maps && (
            <a href={links.maps} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>Nearby on Maps</span>
            </a>
          )}
          {links.search && (
            <a href={links.search} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span>Look it up</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
