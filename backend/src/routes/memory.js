// src/routes/memory.js
//
// User-facing, mounted under /api (requireAuth + rateLimitByUid already
// applied at the app level). Always reads from users/{req.uid}/memory —
// the verified uid, never a client-supplied one.

import { Router } from 'express';
import { db } from '../firebaseAdmin.js';
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

memoryRouter.delete('/memory', async (req, res) => {
  try {
    const memoryCol = db.collection('users').doc(req.uid).collection('memory');
    const snap = await memoryCol.get();
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    res.json({ success: true, message: 'All memory tiers permanently erased.' });
  } catch (err) {
    console.error('[DELETE /api/memory] failed for uid=%s:', req.uid, err.message);
    res.status(500).json({ error: 'Could not erase memory layers.' });
  }
});
