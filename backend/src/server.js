// src/server.js
import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import { rateLimitByUid } from './middleware/rateLimit.js';
import { verifyOidc } from './middleware/verifyOidc.js';
import { journalRouter } from './routes/journal.js';
import { memoryRouter } from './routes/memory.js';
import { dashboardRouter } from './routes/dashboard.js';
import { internalRouter } from './routes/internal.js';
import { attachVoiceRelay } from './live/liveRelay.js';

const app = express();

// Article 5: restrictive CORS — only the known frontend origin(s), not '*'.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/non-browser tools (no Origin header) and any
      // explicitly configured frontend origin.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '256kb' }));

// Unauthenticated health check for Cloud Run / uptime checks only.
app.get('/healthz', (req, res) => res.status(200).send('ok'));

// Everything under /api requires a verified Firebase ID token, and is
// rate-limited per verified uid.
app.use('/api', requireAuth, rateLimitByUid, journalRouter);
app.use('/api', requireAuth, rateLimitByUid, memoryRouter);
app.use('/api', requireAuth, rateLimitByUid, dashboardRouter);

// Article 9: separate trust boundary — OIDC from Cloud Scheduler only,
// never a Firebase user token. Deliberately NOT behind requireAuth.
app.use('/internal', verifyOidc, internalRouter);

// Generic error handler — never leak internals to the client (Article 5).
app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  console.log(`Personal Gemini Journal backend listening on :${port}`);
});

// Article 8: voice relay shares the same HTTP server (and thus the same
// Cloud Run instance/port) but is authenticated independently per-socket
// inside attachVoiceRelay — it does not reuse the Express middleware chain.
attachVoiceRelay(server);
