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
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.web.app') ||
        origin.endsWith('.firebaseapp.com') ||
        origin.endsWith('.github.io') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '256kb' }));

// Root route: seamlessly redirect browser visitors to the frontend app, or return API status
app.get('/', (req, res) => {
  if (req.query.format === 'json' || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.json({
      name: 'Tendril Neural Journal API',
      status: 'operational',
      frontend: 'https://tendril-74291.web.app',
      health: '/healthz',
    });
  }
  res.redirect('https://tendril-74291.web.app');
});

// Health check endpoints for uptime probes and monitoring
app.get(['/health', '/healthz'], (req, res) => res.status(200).json({ status: 'ok', service: 'tendril-api' }));

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
