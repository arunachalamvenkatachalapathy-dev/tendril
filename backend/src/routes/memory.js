// src/routes/memory.js
//
// User-facing, mounted under /api (requireAuth + rateLimitByUid already
// applied at the app level). Always reads from users/{req.uid}/memory —
// the verified uid, never a client-supplied one.

import { Router } from 'express';
import { loadMemoryContext } from '../memory/pipeline.js';

export const memoryRouter = Router();

memoryRouter.get('/memory/context', async (req, res) => {
  try {
    const context = await loadMemoryContext(req.uid);
    res.json(context);
  } catch (err) {
    console.error('[GET /api/memory/context] failed for uid=%s:', req.uid, err.message);
    res.status(500).json({ error: 'Could not load your context right now.' });
  }
});
