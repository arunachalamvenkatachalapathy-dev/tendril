import { useEffect, useState, useCallback } from 'react';
import { watchAuthState, signOut } from './firebase.js';
import { listEntries, getEntry } from './api.js';
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
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to);
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

  useEffect(() => {
    if (user) refreshEntries();
  }, [user, refreshEntries]);

  function handleNewEntry() {
    setView({ mode: 'compose' });
    setComposerKey((k) => k + 1);
    if (path !== '/') navigate('/');
  }

  async function handleOpenEntry(id) {
    try {
      const entry = await getEntry(id);
      setView({ mode: 'detail', entry });
      if (path !== '/') navigate('/');
    } catch (err) {
      console.error('Failed to load entry:', err.message);
    }
  }

  function handleSaved() {
    refreshEntries();
    handleNewEntry();
  }

  if (user === undefined) {
    return (
      <div className="tendril-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
          <span className="frequency-bar" style={{ width: '4px', height: '16px', background: '#10b981' }} />
          <span>Initializing Tendril Neural Core…</span>
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
      {/* Floating Island Navigation */}
      <header className="floating-nav">
        <div className="brand-wrapper" onClick={() => navigate('/')}>
          <div className="brand-glyph">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12" />
              <path d="M12 6a6 6 0 0 1 6 6c0 3.3-2.7 6-6 6s-6-2.7-6-6" />
              <path d="M12 10a2 2 0 0 1 2 2" />
            </svg>
          </div>
          <div className="brand-title">
            Tendril <span className="accent">AI</span>
          </div>
        </div>

        {/* Center Nav Switcher */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${path === '/' ? 'active' : ''}`}
            onClick={() => navigate('/')}
          >
            <span>✍️ Journal</span>
          </button>
          <button
            className={`nav-tab-btn ${path === '/dashboard' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
          >
            <span>📊 Circadian & Heatmap</span>
          </button>
          <button
            className="nav-tab-btn"
            onClick={() => setShowMemoryModal(true)}
            style={{ color: '#34d399' }}
          >
            <span>🧠 Memory Layers</span>
          </button>
        </nav>

        {/* User Identity Chip */}
        <div className="user-profile-chip">
          <span className="user-email-badge">
            {user.email}
          </span>
          <button className="btn-signout" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      {path === '/dashboard' ? (
        <Dashboard uid={user.uid} onBack={() => navigate('/')} />
      ) : (
        <div className="workspace-grid">
          {/* Column 1: Journal Stream List */}
          <EntryList
            entries={entries}
            loading={entriesLoading}
            onNewEntry={handleNewEntry}
            onOpenEntry={handleOpenEntry}
            selectedId={view.mode === 'detail' ? view.entry?.id : null}
          />

          {/* Column 2: Composer Center Canvas */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                onSurfacedIdeas={(newIdeas) => setSurfacedIdeas(prev => [...newIdeas, ...prev].slice(0, 8))}
              />
            ) : (
              <EntryComposer
                key={composerKey}
                onSaved={handleSaved}
                onExtractIdeas={(newExchanges) => {
                  // extract idea snippets if useful
                }}
              />
            )}
          </div>

          {/* Column 3: Live Idea Vault Stream */}
          <IdeaStream ideas={surfacedIdeas} />
        </div>
      )}

      {/* Memory Layers Inspector Modal */}
      {showMemoryModal && (
        <MemoryProfileModal onClose={() => setShowMemoryModal(false)} />
      )}
    </div>
  );
}
