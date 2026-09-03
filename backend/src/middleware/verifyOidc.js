// src/middleware/verifyOidc.js
//
// Article 9: the scheduled compaction endpoints are invoked ONLY by Cloud
// Scheduler using an OIDC identity token bound to a dedicated service
// account. This is a completely separate trust path from requireAuth
// (Firebase user tokens) — a signed-in user's ID token must NOT work
// here, and this token must NOT work on any /api/* route.

import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

const EXPECTED_AUDIENCE = process.env.SCHEDULER_AUDIENCE; // the internal endpoint's own URL
const EXPECTED_SERVICE_ACCOUNT = process.env.SCHEDULER_SERVICE_ACCOUNT; // e.g. scheduler-invoker@PROJECT.iam.gserviceaccount.com

export async function verifyOidc(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const idToken = authHeader.slice('Bearer '.length).trim();

    const ticket = await client.verifyIdToken({
      idToken,
      audience: EXPECTED_AUDIENCE,
    });
    const payload = ticket.getPayload();

    if (!payload || payload.email !== EXPECTED_SERVICE_ACCOUNT || !payload.email_verified) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    next();
  } catch (err) {
    console.error('[verifyOidc] rejected:', err.message);
    res.status(401).json({ error: 'Unauthorized.' });
  }
}
