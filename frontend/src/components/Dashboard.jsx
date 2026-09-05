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
      <div className="google-surface-card">
        <div className="google-card-body" style={{ padding: '28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div className="google-eyebrow" style={{ marginBottom: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa' }}>
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z" />
                </svg>
                <span>Activity & Reflection Insights</span>
              </div>
              <h1 style={{ fontSize: '26px', fontWeight: '500', color: '#e3e3e3' }}>
                Journal Activity
              </h1>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn-google-secondary"
                onClick={handleSeedDemoOnDemand}
                disabled={seeding}
                style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '9999px' }}
                title="Load sample entries"
              >
                {seeding ? 'Loading sample…' : 'Load sample notes'}
              </button>

              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                className="google-select"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>

              <button className="btn-google-secondary" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '9999px', padding: '6px 14px', fontSize: '13px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                <span>Back to notes</span>
              </button>
            </div>
          </div>

          {data && (
            <p style={{
              fontSize: '14.5px',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
              maxWidth: '780px',
              marginTop: '16px'
            }}>
              {data.blurb}
            </p>
          )}
        </div>
      </div>

      {loading && !data && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading insights…
        </div>
      )}

      {data && (
        <>
          {/* Gemini Mood Recommendation Pill */}
          <div className="google-surface-card">
            <div className="google-card-body" style={{ padding: '20px 24px' }}>
              <RecommendationCard recommendation={data.recommendation} />
            </div>
          </div>

          {data.entryCount === 0 ? (
            <div className="google-surface-card">
              <div className="google-card-body" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: '#a8c7fa' }}>
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: '500', color: '#e3e3e3', marginBottom: '8px' }}>
                  No entries in this time range yet
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', maxWidth: '420px', margin: '0 auto 20px', lineHeight: '1.5' }}>
                  Write or record reflections to see your patterns over time, or explore with sample entries.
                </p>
                <button
                  className="btn-google-primary"
                  onClick={handleSeedDemoOnDemand}
                  disabled={seeding}
                  style={{ margin: '0 auto', fontSize: '13px', borderRadius: '9999px', padding: '8px 20px' }}
                >
                  <span>{seeding ? 'Loading sample…' : 'Load sample notes'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 2-Column: Clock Face + Heatmap */}
              <div className="dashboard-grid-2col">
                <div className="google-surface-card">
                  <div className="google-card-body" style={{ padding: '24px 28px' }}>
                    <div className="panel-title" style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', fontSize: '15px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a8c7fa' }}>
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span>Daily Reflection Hours</span>
                    </div>
                    <ClockChart hourly={data.hourly} />
                  </div>
                </div>

                <div className="google-surface-card">
                  <div className="google-card-body" style={{ padding: '24px 28px' }}>
                    <div className="panel-title" style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', fontSize: '15px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a8c7fa' }}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>Reflection Calendar</span>
                      </div>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Click cell to inspect</span>
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
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '12px',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#a8c7fa', fontWeight: '500' }}>
                              DATE: {inspectedDay.date}
                            </div>
                            <div style={{ fontSize: '13.5px', color: '#e3e3e3', marginTop: '2px' }}>
                              Dominant mood: <strong style={{ textTransform: 'capitalize' }}>{inspectedDay.dominant}</strong> ({inspectedEntries.length || inspectedDay.count || 1} note{inspectedEntries.length > 1 ? 's' : ''})
                            </div>
                          </div>
                          <button
                            onClick={() => setInspectedDay(null)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}
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
                                  background: 'var(--bg-surface)',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                <div style={{ fontSize: '13px', fontWeight: '500', color: '#e3e3e3', marginBottom: '2px' }}>
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
                <div className="google-surface-card">
                  <div className="google-card-body" style={{ padding: '24px 28px' }}>
                    <div className="panel-title" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', fontSize: '15px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a8c7fa' }}>
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                        <line x1="7" y1="7" x2="7.01" y2="7"/>
                      </svg>
                      <span>Frequent Themes</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {data.topThemes.map((t) => (
                        <span
                          key={t}
                          className="google-chip"
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
