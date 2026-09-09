// src/routes/memory.js
//
// User-facing, mounted under /api (requireAuth + rateLimitByUid already
// applied at the app level). Always reads from users/{req.uid}/memory —
// the verified uid, never a client-supplied one.

import { Router } from 'express';
import { db } from '../firebaseAdmin.js';
import { loadMemoryContext } from '../memory/pipeline.js';
import { generateJsonObject } from '../gemini.js';

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

memoryRouter.post('/sparks/synthesize', async (req, res) => {
  try {
    const { ideas } = req.body;
    if (!Array.isArray(ideas) || ideas.length === 0) {
      return res.status(400).json({ error: 'ideas array is required.' });
    }

    const bulletList = ideas
      .map((b, i) => `${i + 1}. ${typeof b === 'string' ? b : (b.text || '')}`)
      .filter(Boolean)
      .join('\n');

    const prompt = `You are analyzing a person's recent journal sparks — raw idea fragments extracted from their reflections.

Sparks:
${bulletList}

Look across ALL of them holistically. Find the hidden thread, recurring anxieties, momentum, contradictions.

Return ONLY a JSON object:
{
  "synthesis": "2-3 sentences connecting the dots. What is really going on for this person right now? Be insightful, not generic.",
  "patterns": ["Pattern 1 (max 6 words)", "Pattern 2 (max 6 words)", "Pattern 3 (max 6 words)"],
  "topSpark": "The single most significant or surprising insight buried in these sparks (max 20 words)",
  "nudge": "One gentle question or challenge to help them go deeper (max 15 words)"
}`;

    const result = await generateJsonObject(prompt);
    if (!result) return res.status(500).json({ error: 'Synthesis unavailable.' });

    res.json({
      synthesis: result.synthesis || '',
      patterns: Array.isArray(result.patterns) ? result.patterns.slice(0, 5) : [],
      topSpark: result.topSpark || '',
      nudge: result.nudge || '',
    });
  } catch (err) {
    console.error('[POST /api/sparks/synthesize] failed for uid=%s:', req.uid, err.message);
    res.status(500).json({ error: 'Could not synthesize sparks right now.' });
  }
});
