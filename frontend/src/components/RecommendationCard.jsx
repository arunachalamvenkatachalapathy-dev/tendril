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
              <span>▶</span>
              <span>Play in App (YouTube Music)</span>
            </button>
          )}
          {links.maps && (
            <a href={links.maps} target="_blank" rel="noreferrer">
              📍 Nearby on Maps
            </a>
          )}
          {links.search && (
            <a href={links.search} target="_blank" rel="noreferrer">
              🔎 Look it up
            </a>
          )}
        </div>
      )}
    </div>
  );
}
