import { useEffect, useState } from 'react';
import { getDashboardInsights, seedDemoData } from '../api.js';
import { loadWithCache } from '../lib/localCache.js';
import ClockChart from './ClockChart.jsx';
import HeatmapCalendar from './HeatmapCalendar.jsx';
import RecommendationCard from './RecommendationCard.jsx';

export default function Dashboard({ uid, onBack, onSeedRefresh, entries = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);
  const [seeding, setSeeding] = useState(false);
  const [inspectedDay, setInspectedDay] = useState(null); // { date, dominant, count }

  const inspectedEntries = inspectedDay
    ? entries.filter(e => {
        if (!e.createdAt) return false;
        const d = typeof e.createdAt === 'string' ? e.createdAt : new Date(e.createdAt).toISOString();
        return d.startsWith(inspectedDay.date);
      })
    : [];

  function fetchInsights() {
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
  }

  useEffect(() => {
    fetchInsights();
  }, [uid, rangeDays]);

  async function handleSeedDemoOnDemand() {
    if (!window.confirm('Seed a 14-day sample cognitive journey to demonstrate Diurnal Telemetry and Sentiment Matrix?')) return;
    setSeeding(true);
    try {
      await seedDemoData();
      onSeedRefresh?.();
      fetchInsights();
    } catch (err) {
      alert('Seeding error: ' + err.message);
    } finally {
      setSeeding(false);
    }
  }

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

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn-tendril-secondary"
                onClick={handleSeedDemoOnDemand}
                disabled={seeding}
                style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)', fontSize: '12px' }}
                title="Only loaded on explicit demand"
              >
                {seeding ? '⚡ Seeding Journey…' : '⚡ Demo Mode (Seed Journey)'}
              </button>

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
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: '#fff', marginBottom: '8px' }}>
                  No entries in this time range yet
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', maxWidth: '440px', margin: '0 auto 20px', lineHeight: '1.5' }}>
                  Start writing or speaking in the journal to build your diurnal rhythm, or launch Demo Mode to preview telemetry immediately.
                </p>
                <button
                  className="btn-tendril-primary"
                  onClick={handleSeedDemoOnDemand}
                  disabled={seeding}
                  style={{ margin: '0 auto', fontSize: '13px' }}
                >
                  <span>{seeding ? 'Seeding Demo Journey…' : '⚡ Load Sample Journey (Demo Mode)'}</span>
                </button>
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
                    <div className="panel-title" style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📅</span>
                        <span>30-Day Sentiment Matrix</span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Click cell to inspect</span>
                    </div>
                    <HeatmapCalendar
                      heatmap={data.heatmap}
                      rangeDays={data.rangeDays}
                      selectedDate={inspectedDay?.date}
                      onSelectDate={(date, entry) => setInspectedDay({ date, ...entry })}
                    />

                    {/* Drill-down date drawer */}
                    {inspectedDay && (
                      <div style={{
                        marginTop: '18px',
                        padding: '16px 20px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: '12px',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div>
                            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                              INSPECTED DATE: {inspectedDay.date}
                            </div>
                            <div style={{ fontSize: '14px', color: '#fff', marginTop: '2px' }}>
                              Dominant mood: <strong>{inspectedDay.dominant}</strong> ({inspectedEntries.length || inspectedDay.count || 1} session{inspectedEntries.length > 1 ? 's' : ''})
                            </div>
                          </div>
                          <button
                            onClick={() => setInspectedDay(null)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '16px' }}
                          >
                            ✕
                          </button>
                        </div>

                        {inspectedEntries.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                            {inspectedEntries.map(e => (
                              <div
                                key={e.id}
                                style={{
                                  padding: '10px 14px',
                                  background: 'rgba(0, 0, 0, 0.25)',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '2px' }}>
                                  {e.title || 'Journal Reflection'}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                  {e.summary}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                            No full text entries saved on this date.
                          </div>
                        )}
                      </div>
                    )}
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
