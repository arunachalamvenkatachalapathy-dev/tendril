// src/middleware/rateLimit.js
//
// Article 5: bound Gemini calls per user to control cost and abuse
// exposure. In-memory is fine for a single Cloud Run instance / hackathon
// scale; swap for Firestore- or Redis-backed counters if you scale to
// multiple instances and need it enforced globally.

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 20; // generous for a journaling app

const hits = new Map(); // uid -> [timestamps]

export function rateLimitByUid(req, res, next) {
  const uid = req.uid;
  if (!uid) {
    // Should never happen if requireAuth runs first, but fail safe.
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const existing = (hits.get(uid) || []).filter((ts) => ts > windowStart);

  if (existing.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  existing.push(now);
  hits.set(uid, existing);
  next();
}
