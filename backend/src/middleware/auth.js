// src/middleware/auth.js
//
// Article 2 & Article 5 of AI_STUDIO_CONSTITUTION.md: every route sequence
// starts with "verify auth -> validate input -> authorize -> act -> respond".
// This middleware owns step 1 and attaches the ONLY uid the rest of the
// request lifecycle is allowed to trust: req.uid.

import { verifyToken } from '../firebaseAdmin.js';

export async function requireAuth(req, res, next) {
  try {
    const uid = await verifyToken(req.headers.authorization);
    req.uid = uid;
    next();
  } catch (err) {
    // Generic message to the client (Article 5) — no internal detail leaked.
    res.status(401).json({ error: 'Unauthorized. Please sign in again.' });
  }
}
