// src/lib/localCache.js
//
// Requirement 5b: cache recent/archive memory + dashboard data in
// localStorage, keyed per uid, so the UI can render instantly on reload
// while a fresh fetch happens in the background. Deliberately simple
// (localStorage, not IndexedDB) — the cached payloads are a few KB of
// text/JSON, not media or large datasets.

const TTL_MS = 10 * 60 * 1000; // 10 min — short enough to stay fresh-ish

function key(uid, name) {
  return `pgj:${uid}:${name}`;
}

export function readCache(uid, name) {
  try {
    const raw = localStorage.getItem(key(uid, name));
    if (!raw) return null;
    const { value, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > TTL_MS) return null;
    return value;
  } catch {
    return null;
  }
}

export function writeCache(uid, name, value) {
  try {
    localStorage.setItem(key(uid, name), JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // localStorage can throw (quota, private mode) — caching is a nice-to-
    // have, never let it break the app.
  }
}

/**
 * Fetch-with-cache: returns cached value immediately via onCacheHit (if
 * any), then always fetches fresh data and calls onFresh, writing the
 * result back to cache.
 */
export function loadWithCache(uid, name, fetchFn, { onCacheHit, onFresh } = {}) {
  const cached = readCache(uid, name);
  if (cached && onCacheHit) onCacheHit(cached);

  fetchFn()
    .then((fresh) => {
      writeCache(uid, name, fresh);
      onFresh?.(fresh);
    })
    .catch((err) => {
      console.error(`[localCache] fresh fetch failed for ${name}:`, err.message);
      // If we had no cache either, surface the failure upward.
      if (!cached) onFresh?.(null, err);
    });
}
