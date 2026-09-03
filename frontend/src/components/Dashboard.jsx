import { useEffect, useState } from 'react';
import { getDashboardInsights } from '../api.js';
import { loadWithCache } from '../lib/localCache.js';
import ClockChart from './ClockChart.jsx';
import HeatmapCalendar from './HeatmapCalendar.jsx';
import RecommendationCard from './RecommendationCard.jsx';

export default function Dashboard({ uid, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    loadWithCache(uid, `dashboard-${rangeDays}`, () => getDashboardInsights(rangeDays), {
      onCacheHit: (cached) => {
        setData(cached);
        setLoading(false);
      },
      onFresh: (fresh) => {
        if (fresh) setData(fresh);
        setLoading(false);
      },
    });
  }, [uid, rangeDays]);

  return (
    <div className="dashboard-container">
      
      {/* Top Header Card */}
      <div className="bezel-outer">
        <div className="bezel-inner" style={{ padding: '28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#10b981',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                marginBottom: '6px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                Cognitive Analytics & Circadian Rhythm
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '800', color: '#fff' }}>
                Your Neural Patterns
              </h1>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9999px',
                  color: 'var(--text-secondary)',
                  padding: '8px 16px',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <button className="btn-tendril-secondary" onClick={onBack}>
                ← Return to Journal
              </button>
            </div>
          </div>

          {data && (
            <p style={{
              fontSize: '15px',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
              maxWidth: '780px',
              marginTop: '18px'
            }}>
              {data.blurb}
            </p>
          )}
        </div>
      </div>

      {loading && !data && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Computing cognitive telemetry…
        </div>
      )}

      {data && (
        <>
          {/* Gemini Mood Recommendation Pill */}
          <div className="bezel-outer">
            <div className="bezel-inner" style={{ padding: '20px 24px' }}>
              <RecommendationCard recommendation={data.recommendation} />
            </div>
          </div>

          {data.entryCount === 0 ? (
            <div className="bezel-outer">
              <div className="bezel-inner" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  No entries in this time range yet. Capture thoughts via voice or text to illuminate your diurnal rhythm.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 2-Column Bento: Clock Face + 30-Day Heatmap */}
              <div className="dashboard-grid-2col">
                <div className="bezel-outer">
                  <div className="bezel-inner" style={{ padding: '24px 28px' }}>
                    <div className="panel-title" style={{ marginBottom: '18px' }}>
                      <span>🕒</span>
                      <span>Diurnal Sentiment Clock</span>
                    </div>
                    <ClockChart hourly={data.hourly} />
                  </div>
                </div>

                <div className="bezel-outer">
                  <div className="bezel-inner" style={{ padding: '24px 28px' }}>
                    <div className="panel-title" style={{ marginBottom: '18px' }}>
                      <span>📅</span>
                      <span>30-Day Sentiment Matrix</span>
                    </div>
                    <HeatmapCalendar heatmap={data.heatmap} rangeDays={data.rangeDays} />
                  </div>
                </div>
              </div>

              {/* Frequent Themes */}
              {data.topThemes && data.topThemes.length > 0 && (
                <div className="bezel-outer">
                  <div className="bezel-inner" style={{ padding: '24px 28px' }}>
                    <div className="panel-title" style={{ marginBottom: '14px' }}>
                      <span>🏷️</span>
                      <span>Dominant Life & Project Themes</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {data.topThemes.map((t) => (
                        <span
                          key={t}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '9999px',
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            color: '#34d399',
                            fontSize: '12.5px',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
