import { useEffect, useRef, useState } from 'react';
import { listTrashEntries, restoreEntry, permanentlyDeleteEntry, emptyTrash } from '../api.js';

export default function RecycleBinModal({ onClose, onEntryRestored }) {
  const modalRef = useRef(null);
  const [trashEntries, setTrashEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [emptyLoading, setEmptyLoading] = useState(false);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleBackdropClick(e) {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  }

  async function loadTrash() {
    setLoading(true);
    setError(null);
    try {
      const res = await listTrashEntries();
      setTrashEntries(res.entries || []);
    } catch (err) {
      console.error('Failed to load trash:', err);
      setError('Could not load Recycle Bin items.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrash();
  }, []);

  async function handleRestore(id) {
    setActionLoadingId(id);
    try {
      await restoreEntry(id);
      setTrashEntries((prev) => prev.filter((e) => e.id !== id));
      onEntryRestored?.(id);
    } catch (err) {
      console.error('Restore failed:', err);
      setError('Failed to restore entry. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handlePermanentDelete(id) {
    if (!window.confirm('Are you sure you want to permanently delete this reflection? This cannot be undone.')) {
      return;
    }
    setActionLoadingId(id);
    try {
      await permanentlyDeleteEntry(id);
      setTrashEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Permanent delete failed:', err);
      setError('Failed to delete entry.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleEmptyTrash() {
    if (!window.confirm(`Empty all ${trashEntries.length} items from the Recycle Bin permanently?`)) {
      return;
    }
    setEmptyLoading(true);
    try {
      await emptyTrash();
      setTrashEntries([]);
    } catch (err) {
      console.error('Empty trash failed:', err);
      setError('Failed to empty Recycle Bin.');
    } finally {
      setEmptyLoading(false);
    }
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'rgba(18, 22, 34, 0.96)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid var(--border-medium)',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 24px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'rgba(242, 139, 130, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f28b82',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#e3e3e3' }}>Recycle Bin</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Recover deleted chats & reflections
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {trashEntries.length > 0 && (
              <button
                type="button"
                onClick={handleEmptyTrash}
                disabled={emptyLoading}
                style={{
                  background: 'rgba(242, 139, 130, 0.12)',
                  border: '1px solid rgba(242, 139, 130, 0.25)',
                  color: '#f28b82',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                {emptyLoading ? 'Emptying…' : 'Empty Trash'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(242, 139, 130, 0.12)',
                border: '1px solid rgba(242, 139, 130, 0.25)',
                borderRadius: '10px',
                color: '#f28b82',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Loading Recycle Bin…
            </div>
          ) : trashEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: 'var(--text-muted)',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <div style={{ fontSize: '15px', fontWeight: '500', color: '#e3e3e3', marginBottom: '6px' }}>
                Recycle Bin is empty
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '340px', margin: '0 auto', lineHeight: '1.5' }}>
                Reflections you delete are safely moved here instead of being lost permanently. You can restore them anytime.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {trashEntries.map((entry) => {
                const isActing = actionLoadingId === entry.id;
                const formattedDate = entry.deletedAt
                  ? new Date(entry.deletedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : (entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'Recent');

                return (
                  <div
                    key={entry.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#e3e3e3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.title || 'Untitled Reflection'}
                        </span>
                        {entry.mood && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              background: 'rgba(168, 199, 250, 0.1)',
                              color: '#a8c7fa',
                              border: '1px solid rgba(168, 199, 250, 0.2)',
                            }}
                          >
                            {entry.mood}
                          </span>
                        )}
                      </div>

                      {entry.summary && (
                        <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {entry.summary}
                        </p>
                      )}

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Deleted: {formattedDate}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleRestore(entry.id)}
                        disabled={isActing}
                        title="Restore to Journal"
                        style={{
                          background: 'rgba(109, 213, 140, 0.12)',
                          border: '1px solid rgba(109, 213, 140, 0.3)',
                          color: '#6dd58c',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: isActing ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 14 4 9 9 4" />
                          <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                        </svg>
                        <span>{isActing ? 'Restoring…' : 'Restore'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(entry.id)}
                        disabled={isActing}
                        title="Delete Forever"
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: 'var(--text-muted)',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          cursor: isActing ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {trashEntries.length} {trashEntries.length === 1 ? 'item' : 'items'} in Recycle Bin
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              color: '#e3e3e3',
              padding: '6px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
