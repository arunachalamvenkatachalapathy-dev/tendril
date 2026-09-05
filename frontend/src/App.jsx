import { useEffect, useState, useCallback } from 'react';
import { watchAuthState, signOut } from './firebase.js';
import { listEntries, getEntry, seedDemoData, getMemoryContext } from './api.js';
import Login from './components/Login.jsx';
import EntryList from './components/EntryList.jsx';
import EntryComposer from './components/EntryComposer.jsx';
import EntryDetail from './components/EntryDetail.jsx';
import VoiceComposer from './components/VoiceComposer.jsx';
import ModeToggle from './components/ModeToggle.jsx';
import Dashboard from './components/Dashboard.jsx';
import IdeaStream from './components/IdeaStream.jsx';
import MemoryProfileModal from './components/MemoryProfileModal.jsx';

function usePath() {
  const getSubPath = () => {
    if (window.location.hash) {
      return window.location.hash.replace(/^#/, '') || '/';
    }
    const full = window.location.pathname;
    const stripped = full.replace(/^\/tendril\/?/, '/');
    return stripped || '/';
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

  useEffect(() => watchAuthState(setUser), []);

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

  async function handleSeedDemo() {
    if (!window.confirm('Load a 14-day sample cognitive journey to demonstrate Diurnal Telemetry, Sentiment Heatmap, and Layered Memory?')) return;
    setSeedingDemo(true);
    try {
      await seedDemoData();
      await refreshEntries();
      await refreshMemoryAndIdeas();
      navigate('/dashboard');
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
          <svg className="google-spinner" width="32" height="32" viewBox="0 0 50 50">
            <circle className="google-spinner-path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
          </svg>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading Tendril…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="tendril-shell">
        <Login />
      </div>
    );
  }

  return (
    <div className="tendril-shell">
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
          <button
            className={`nav-tab-btn ${path === '/' && mobileTab === 'reflect' ? 'active' : ''}`}
            onClick={() => { navigate('/'); setMobileTab('reflect'); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span>Journal</span>
          </button>
          <button
            className={`nav-tab-btn ${path === '/dashboard' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <span>Activity</span>
          </button>
          <button
            className="nav-tab-btn"
            onClick={() => setShowMemoryModal(true)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span>Memory</span>
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
            <span>{seedingDemo ? 'Loading sample…' : 'Sample entries'}</span>
          </button>
        </nav>

        {/* User Identity & Account Actions */}
        <div className="user-profile-chip">
          <div className="google-account-pill">
            <div className="google-user-avatar">
              {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="user-email-badge desktop-only">
              {user.email}
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
          <button className="btn-signout" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      {path === '/dashboard' ? (
        <Dashboard uid={user.uid} onBack={() => { navigate('/'); setMobileTab('reflect'); }} onSeedRefresh={refreshEntries} entries={entries} />
      ) : (
        <div className={`workspace-grid mobile-tab-${mobileTab}`}>
          {/* Column 1: Journal Stream List */}
          <div className="workspace-col col-timeline">
            <EntryList
              entries={entries}
              loading={entriesLoading}
              onNewEntry={handleNewEntry}
              onOpenEntry={handleOpenEntry}
              onSeedDemo={handleSeedDemo}
              seeding={seedingDemo}
              selectedId={view.mode === 'detail' ? view.entry?.id : null}
            />
          </div>

          {/* Column 2: Composer Center Canvas */}
          <div className="workspace-col col-reflect" style={{ display: 'flex', flexDirection: 'column' }}>
            {view.mode !== 'detail' && (
              <ModeToggle mode={composerMode} onChange={setComposerMode} />
            )}

            {view.mode === 'detail' ? (
              <EntryDetail entry={view.entry} onBack={handleNewEntry} />
            ) : composerMode === 'voice' ? (
              <VoiceComposer
                key={composerKey}
                onSaved={handleSaved}
                onSwitchToText={() => setComposerMode('text')}
                onSurfacedIdeas={(newIdeas) => setSurfacedIdeas(prev => [...newIdeas, ...prev].slice(0, 10))}
              />
            ) : (
              <EntryComposer
                key={composerKey}
                onSaved={handleSaved}
                onExtractIdeas={(newIdeas) => {
                  if (newIdeas && newIdeas.length > 0) {
                    setSurfacedIdeas(prev => [...newIdeas, ...prev].slice(0, 10));
                  }
                }}
              />
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
          <span className="mobile-nav-label">Journal</span>
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
          <span className="mobile-nav-label">Notes</span>
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
          <span className="mobile-nav-label">Insights</span>
        </button>

        <button
          className={`mobile-nav-item ${path === '/dashboard' ? 'active' : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          <div className="mobile-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <span className="mobile-nav-label">Activity</span>
        </button>

        <button
          className="mobile-nav-item"
          onClick={() => setShowMemoryModal(true)}
        >
          <div className="mobile-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <span className="mobile-nav-label">Memory</span>
        </button>
      </nav>

      {/* Memory Inspector Modal */}
      {showMemoryModal && (
        <MemoryProfileModal onClose={() => setShowMemoryModal(false)} />
      )}
    </div>
  );
}
