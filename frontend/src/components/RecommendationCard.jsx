export default function RecommendationCard({ recommendation }) {
  if (!recommendation) return null;

  const { message, links } = recommendation;
  const hasLinks = links && (links.youtubeMusic || links.maps || links.search);

  return (
    <div className="recommendation-card">
      <p>{message}</p>
      {hasLinks && (
        <div className="recommendation-links">
          {links.youtubeMusic && (
            <a href={links.youtubeMusic} target="_blank" rel="noreferrer">
              ▶ YouTube Music
            </a>
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
