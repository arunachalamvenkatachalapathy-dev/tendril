// src/routes/internal.js
//
// Mounted at /internal — protected by verifyOidc, NOT requireAuth. See
// Article 9 in AI_STUDIO_CONSTITUTION.md: this is a completely separate
// trust boundary from the user-facing /api routes, and each per-uid
// compaction call touches exactly one user's memory subtree.

import { Router } from 'express';
import {
  getUidsWithPendingNow,
  getUidsWithTodayDocs,
  compactNowToToday,
  rollupRecentAndArchive,
} from '../memory/pipeline.js';

export const internalRouter = Router();

// Cloud Scheduler: 0 1 * * * (once daily)
internalRouter.post('/compact/daily', async (req, res) => {
  try {
    const uids = await getUidsWithPendingNow();
    const results = [];
    for (const uid of uids) {
      // Sequential, not Promise.all — bounds concurrent Gemini calls and
      // keeps each user's compaction fully isolated and easy to reason
      // about/log individually.
      const result = await compactNowToToday(uid);
      results.push({ uid, ...result });
    }
    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('[POST /internal/compact/daily] failed:', err.message);
    res.status(500).json({ error: 'Daily compaction failed.' });
  }
});

// Cloud Scheduler: 0 2 * * * (once daily, after the job above)
internalRouter.post('/compact/rollup', async (req, res) => {
  try {
    const uids = await getUidsWithTodayDocs();
    const results = [];
    for (const uid of uids) {
      const result = await rollupRecentAndArchive(uid);
      results.push({ uid, ...result });
    }
    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('[POST /internal/compact/rollup] failed:', err.message);
    res.status(500).json({ error: 'Rollup compaction failed.' });
  }
});
