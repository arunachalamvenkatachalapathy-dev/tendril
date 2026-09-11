import { useEffect, useState, useCallback } from 'react';
import { watchAuthState, signOut } from './firebase.js';
import { listEntries, getEntry, seedDemoData, getMemoryContext, deleteEntry } from './api.js';
import Login from './components/Login.jsx';
import EntryList from './components/EntryList.jsx';
import EntryComposer from './components/EntryComposer.jsx';
import EntryDetail from './components/EntryDetail.jsx';
import VoiceComposer from './components/VoiceComposer.jsx';
import ModeToggle from './components/ModeToggle.jsx';
import Dashboard from './components/Dashboard.jsx';
import IdeaStream from './components/IdeaStream.jsx';
import MemoryProfileModal from './components/MemoryProfileModal.jsx';
import HuntView from './components/HuntView.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import GeminiSprinkleLoader from './components/GeminiSprinkleLoader.jsx';
import { InAppMusicPlayer } from './components/FeelSongsPlayer.jsx';
import ThemeSelector from './components/ThemeSelector.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { useTheme } from './theme.js';

function usePath() {
  const getSubPath = () => {
    if (window.location.hash) {
      return window.location.hash.replace(/^#/, '') || '/universe';
    }
    const full = window.location.pathname;
    const stripped = full.replace(/^\/tendril\/?/, '/');
    if (!stripped || stripped === '/') return '/universe';
    return stripped;
  };

  const [path, setPath] = useState(getSubPath());

  useEffect(() => {
    const onPop = () => setPath(getSubPath());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  const navigate = useCallback((to) => {
    const isGhPages = window.location.pathname.startsWith('/tendril');
    const target = isGhPages ? `/tendril${to === '/' ? '' : to}` : to;
    window.history.pushState({}, '', target);
    setPath(to);
  }, []);

  return [path, navigate];
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [view, setView] = useState({ mode: 'compose' }); // { mode: 'compose' } | { mode: 'detail', entry }
  const [composerKey, setComposerKey] = useState(0);
  const [composerMode, setComposerMode] = useState('text'); // 'text' | 'voice'
  const [surfacedIdeas, setSurfacedIdeas] = useState([]);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [mobileTab, setMobileTab] = useState('reflect'); // 'reflect' | 'timeline' | 'sparks'
  const [path, navigate] = usePath();
  const [musicTrack, setMusicTrack] = useState(null);
  const [theme, setTheme] = useTheme(user?.uid);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const onPlay = (e) => setMusicTrack(e.detail);
    window.addEventListener('tendril:playMusic', onPlay);
    return () => window.removeEventListener('tendril:playMusic', onPlay);
  }, []);

  useEffect(() => {
    const unsub = watchAuthState((u) => {
      setUser(u || null);
    });
    // Safety guard: prevent infinite "Loading Tendril..." hang on slow networks or blocked storage
    const timer = setTimeout(() => {
      setUser((curr) => (curr === undefined ? null : curr));
    }, 3000);
    return () => {
      if (typeof unsub === 'function') unsub();
      clearTimeout(timer);
    };
  }, []);

  const refreshEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const { entries } = await listEntries();
      setEntries(entries || []);
    } catch (err) {
      console.error('Failed to load entries:', err.message);
    } finally {
      setEntriesLoading(false);
    }
  }, []);

  const refreshMemoryAndIdeas = useCallback(async () => {
    try {
      const mem = await getMemoryContext();
      if (mem?.todaysIdeas && mem.todaysIdeas.length > 0) {
        const formatted = mem.todaysIdeas.map(item => 
          typeof item === 'string' ? { type: 'spark', text: item } : item
        );
        setSurfacedIdeas(formatted);
      }
    } catch (err) {
      console.warn('Could not load memory context:', err.message);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshEntries();
      refreshMemoryAndIdeas();
    }
  }, [user, refreshEntries, refreshMemoryAndIdeas]);

  // Always refresh entries when viewing Actions/Activity so recent speech is immediately visible
  useEffect(() => {
    if (user && path === '/dashboard') {
      refreshEntries();
      refreshMemoryAndIdeas();
    }
  }, [user, path, refreshEntries, refreshMemoryAndIdeas]);

  function handleNewEntry() {
    setView({ mode: 'compose' });
    setComposerKey((k) => k + 1);
    setMobileTab('reflect');
    if (path !== '/') navigate('/');
  }

  async function handleOpenEntry(id) {
    try {
      const entry = await getEntry(id);
      setView({ mode: 'detail', entry });
      setMobileTab('reflect');
      if (path !== '/') navigate('/');
    } catch (err) {
      console.error('Failed to load entry:', err.message);
    }
  }

  function handleSaved() {
    refreshEntries();
    refreshMemoryAndIdeas();
    handleNewEntry();
  }

  async function handleDeleteEntry(id) {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    // Optimistically remove from state so the UI responds immediately
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (view.mode === 'detail' && view.entry?.id === id) {
      handleNewEntry();
    }
    try {
      await deleteEntry(id);
      await refreshMemoryAndIdeas();
    } catch (err) {
      console.error('Delete entry failed:', err);
      // Re-fetch to restore correct state if deletion failed on server
      await refreshEntries();
      alert('Could not delete note: ' + err.message);
    }
  }

  async function handleRemoveDuplicates() {
    const seenTitles = new Map();
    const toDelete = [];
    for (const e of entries) {
      const key = (e.title || '').trim().toLowerCase();
      if (!key) continue;
      if (seenTitles.has(key)) {
        toDelete.push(e.id);
      } else {
        seenTitles.set(key, e.id);
      }
    }
    if (toDelete.length === 0) {
      alert('No duplicate notes found in your stream!');
      return;
    }
    if (!window.confirm(`Found ${toDelete.length} duplicate note(s). Remove them now?`)) return;
    try {
      for (const id of toDelete) {
        await deleteEntry(id);
      }
      await refreshEntries();
      await refreshMemoryAndIdeas();
      alert(`Removed ${toDelete.length} duplicate note(s)!`);
    } catch (err) {
      alert('Failed removing duplicates: ' + err.message);
    }
  }

  async function handleCleanBeyondSept2() {
    const sept2End = new Date('2026-09-02T23:59:59.999Z');
    const toDelete = entries.filter((e) => {
      const d = e.createdAt ? new Date(e.createdAt) : null;
      return d && d > sept2End;
    });

    if (toDelete.length === 0) {
      alert('No notes found beyond September 2, 2026.');
      return;
    }

    if (!window.confirm(`Found ${toDelete.length} note(s) dated beyond September 2, 2026. Remove them now?`)) return;

    // Optimistically update UI
    const deleteIds = new Set(toDelete.map((e) => e.id));
    setEntries((prev) => prev.filter((e) => !deleteIds.has(e.id)));

    try {
      for (const e of toDelete) {
        await deleteEntry(e.id).catch(() => {});
      }
      await refreshEntries();
      await refreshMemoryAndIdeas();
      alert(`Cleaned ${toDelete.length} note(s) beyond September 2!`);
    } catch (err) {
      console.error('Clean beyond Sept 2 failed:', err);
      await refreshEntries();
      alert('Failed cleaning some notes: ' + err.message);
    }
  }

  const handleSurfacedIdeas = useCallback((newIdeas) => {
    if (newIdeas && newIdeas.length > 0) {
      setSurfacedIdeas((prev) => {
        const existingTexts = new Set(prev.map((i) => (typeof i === 'string' ? i : i.text)));
        const filteredNew = newIdeas.filter((i) => {
          const text = typeof i === 'string' ? i : i.text;
          return text && !existingTexts.has(text);
        });
        if (filteredNew.length === 0) return prev;
        return [...filteredNew, ...prev].slice(0, 10);
      });
    }
  }, []);

  async function handleSeedDemo() {
    if (!window.confirm('Load a 14-day sample cognitive journey to demonstrate Diurnal Telemetry, Sentiment Heatmap, and Layered Memory?')) return;
    setSeedingDemo(true);
    try {
      await seedDemoData();
      await refreshEntries();
      await refreshMemoryAndIdeas();
    } catch (err) {
      alert('Failed to seed demo data: ' + err.message);
    } finally {
      setSeedingDemo(false);
    }
  }

  if (user === undefined) {
    return (
      <div className="tendril-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="google-loading-wrap">
          <GeminiSprinkleLoader
            size={48}
            label="Loading Tendril…"
            sublabel="Setting up your journal space"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`tendril-shell ${path === '/' && user ? 'shell-reflect-fixed' : ''}`}>
      {!user ? (
        <Login />
      ) : (
        <>
          {/* Google App Header Bar */}
          <header className="google-app-header">
        <div className="brand-wrapper" onClick={() => { navigate('/'); setMobileTab('reflect'); }}>
          <div className="brand-glyph">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#a8c7fa' }}>
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z" />
            </svg>
          </div>
          <div className="brand-title">
            Tendril <span className="brand-subtitle">Journal</span>
          </div>
        </div>

        {/* Center Desktop Navigation Tabs */}
        <nav className="nav-tabs desktop-only">
          <div style={{ position: 'relative' }}>
            <button
              className={`nav-tab-btn ${path === '/' && mobileTab === 'reflect' ? 'active' : ''}`}
              onClick={() => { navigate('/'); setMobileTab('reflect'); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              <span>Reflect</span>
            </button>
          </div>
          <button
            className={`nav-tab-btn ${path === '/dashboard' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span>Actions</span>
          </button>
          <button
            className={`nav-tab-btn nav-tab-universe ${(path === '/universe' || path === '/hunt') ? 'active' : ''}`}
            onClick={() => navigate('/universe')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              <path d="M2 12h20" />
            </svg>
            <span>Universe</span>
          </button>
          <button
            className="nav-tab-btn nav-tab-demo"
            onClick={handleSeedDemo}
            disabled={seedingDemo}
            title="Load sample journal entries"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <path d="M10 2v7.31M14 2v7.31M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0"/>
            </svg>
            <span>{seedingDemo ? 'Loading…' : 'Try Demo'}</span>
          </button>
        </nav>

        {/* User Identity & Settings (Themes and Sign Out inside Settings) */}
        <div className="user-profile-chip" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            className="google-account-pill"
            onClick={() => setShowSettingsModal(true)}
            style={{ cursor: 'pointer' }}
            title="Open Account & Settings"
          >
            <div className="google-user-avatar">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email ? user.email.charAt(0).toUpperCase() : 'G'}
            </div>
            <span className="user-email-badge desktop-only">
              {user.displayName || user.email || 'Guest Explorer'}
            </span>
          </div>

          <button
            className="mobile-only btn-mobile-new"
            onClick={handleNewEntry}
            title="New note"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>

          <button
            className={`nav-tab-btn ${showSettingsModal ? 'active' : ''}`}
            onClick={() => setShowSettingsModal(true)}
            title="Settings: Atmosphere Themes & Account"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 13px',
              borderRadius: '9999px',
              background: showSettingsModal ? 'rgba(168, 199, 250, 0.18)' : 'rgba(255, 255, 255, 0.05)',
              border: showSettingsModal ? '1px solid #a8c7fa' : '1px solid var(--border-subtle)',
              color: showSettingsModal ? '#a8c7fa' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontWeight: '500',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      {path === '/dashboard' ? (
        <Dashboard uid={user.uid} onBack={() => { navigate('/'); setMobileTab('reflect'); }} onSeedRefresh={refreshEntries} entries={entries} />
      ) : (path === '/universe' || path === '/hunt') ? (
        <HuntView
          entries={entries}
          ideas={surfacedIdeas}
          onOpenEntry={handleOpenEntry}
          onDeleteEntry={handleDeleteEntry}
          onBack={() => { navigate('/'); setMobileTab('reflect'); }}
        />
      ) : (
        <div className={`workspace-grid mobile-tab-${mobileTab}`}>
          {/* Column 1: Journal Stream List */}
          <div className="workspace-col col-timeline">
            <EntryList
              entries={entries}
              loading={entriesLoading}
              onNewEntry={handleNewEntry}
              onOpenEntry={handleOpenEntry}
              onDeleteEntry={handleDeleteEntry}
              onRemoveDuplicates={handleRemoveDuplicates}
              onCleanBeyondSept2={handleCleanBeyondSept2}
              onSeedDemo={handleSeedDemo}
              seeding={seedingDemo}
              selectedId={view.mode === 'detail' ? view.entry?.id : null}
            />
          </div>

          {/* Column 2: Composer Center Canvas */}
          <div className="workspace-col col-reflect">
            {view.mode !== 'detail' && (
              <ModeToggle mode={composerMode} onChange={setComposerMode} />
            )}

            {view.mode === 'detail' ? (
              <EntryDetail entry={view.entry} onBack={handleNewEntry} onDeleteEntry={handleDeleteEntry} />
            ) : composerMode === 'voice' ? (
              <ErrorBoundary>
                <VoiceComposer
                  key={composerKey}
                  onSaved={handleSaved}
                  onSwitchToText={() => setComposerMode('text')}
                  onSurfacedIdeas={handleSurfacedIdeas}
                />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary>
                <EntryComposer
                  key={composerKey}
                  onSaved={handleSaved}
                  onExtractIdeas={handleSurfacedIdeas}
                  onSwitchToVoice={() => setComposerMode('voice')}
                />
              </ErrorBoundary>
            )}
          </div>

          {/* Column 3: Live Idea Vault Stream */}
          <div className="workspace-col col-sparks">
            <IdeaStream ideas={surfacedIdeas} />
          </div>
        </div>
      )}


      {/* Material Design 3 Mobile Navigation Dock */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-nav-item ${path === '/' && mobileTab === 'reflect' ? 'active' : ''}`}
          onClick={() => {
            if (path !== '/') navigate('/');
            setMobileTab('reflect');
          }}
        >
          <div className="mobile-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <span className="mobile-nav-label">Reflect</span>
        </button>

        <button
          className={`mobile-nav-item ${path === '/' && mobileTab === 'timeline' ? 'active' : ''}`}
          onClick={() => {
            if (path !== '/') navigate('/');
            setMobileTab('timeline');
          }}
        >
          <div className="mobile-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            {entries.length > 0 && <span className="mobile-nav-badge">{entries.length}</span>}
          </div>
          <span className="mobile-nav-label">Stream</span>
        </button>

        <button
          className={`mobile-nav-item ${path === '/' && mobileTab === 'sparks' ? 'active' : ''}`}
          onClick={() => {
            if (path !== '/') navigate('/');
            setMobileTab('sparks');
          }}
        >
          <div className="mobile-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6Z"/>
            </svg>
            {surfacedIdeas.length > 0 && <span className="mobile-nav-badge">{surfacedIdeas.length}</span>}
          </div>
          <span className="mobile-nav-label">Sparks</span>
        </button>

        <button
          className={`mobile-nav-item ${path === '/dashboard' ? 'active' : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          <div className="mobile-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <span className="mobile-nav-label">Actions</span>
        </button>

        <button
          className={`mobile-nav-item ${(path === '/universe' || path === '/hunt') ? 'active' : ''}`}
          onClick={() => navigate('/universe')}
        >
          <div className="mobile-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              <path d="M2 12h20" />
            </svg>
          </div>
          <span className="mobile-nav-label">Universe</span>
        </button>
      </nav>

          {/* Settings Modal (housing Atmosphere Themes & Sign Out) */}
          {showSettingsModal && (
            <SettingsModal
              user={user}
              currentTheme={theme}
              onSelectTheme={setTheme}
              onSignOut={signOut}
              onClose={() => setShowSettingsModal(false)}
            />
          )}

          {/* Memory Inspector Modal */}
          {showMemoryModal && (
            <MemoryProfileModal
              onClose={() => setShowMemoryModal(false)}
              entries={entries}
              onOpenEntry={(id) => {
                setShowMemoryModal(false);
                handleOpenEntry(id);
              }}
            />
          )}
        </>
      )}

      {/* In-App Music Player — begins strictly after user login */}
      {user && <InAppMusicPlayer track={musicTrack} />}
    </div>
  );
}
