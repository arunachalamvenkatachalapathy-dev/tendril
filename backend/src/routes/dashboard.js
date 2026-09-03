// src/routes/dashboard.js
//
// User-facing, mounted under /api. Everything here reads only from
// users/{req.uid}/entries and users/{req.uid}/memory — the verified uid.
// No new Firestore documents are written by this route (requirement 6a:
// compute on-the-fly from existing entry data).

import { Router } from 'express';
import { db } from '../firebaseAdmin.js';
import { loadMemoryContext } from '../memory/pipeline.js';
import { generateJsonObject } from '../gemini.js';
import { recommendationPrompt } from '../memory/dashboardPrompts.js';

export const dashboardRouter = Router();

const WORRY_MOODS = new Set(['stressed', 'frustrated', 'sad', 'anxious']);
const HAPPY_MOODS = new Set(['happy', 'excited', 'hopeful', 'calm']);

function bucketFor(mood) {
  if (WORRY_MOODS.has(mood)) return 'worry';
  if (HAPPY_MOODS.has(mood)) return 'happy';
  return 'neutral';
}

dashboardRouter.get('/dashboard/insights', async (req, res) => {
  try {
    const rangeDays = Math.min(parseInt(req.query.days, 10) || 30, 90);
    const since = new Date();
    since.setDate(since.getDate() - rangeDays);

    const snap = await db
      .collection('users')
      .doc(req.uid)
      .collection('entries')
      .orderBy('createdAt', 'desc')
      .limit(500) // hard ceiling — dashboard is a pattern view, not a full export
      .get();

    const entries = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          mood: data.mood || 'neutral',
          themes: data.themes || [],
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null),
        };
      })
      .filter((e) => e.createdAt && e.createdAt >= since);

    // --- Clock-face: time-of-day bucket (0-23h) -> {worry, happy, neutral} counts
    const hourly = Array.from({ length: 24 }, () => ({ worry: 0, happy: 0, neutral: 0 }));
    // --- Heatmap: date (YYYY-MM-DD) -> dominant bucket for that day
    const dayBuckets = {}; // date -> { worry, happy, neutral } counts

    for (const e of entries) {
      const bucket = bucketFor(e.mood);
      const hour = e.createdAt.getHours();
      hourly[hour][bucket] += 1;

      const dateLabel = e.createdAt.toISOString().slice(0, 10);
      if (!dayBuckets[dateLabel]) dayBuckets[dateLabel] = { worry: 0, happy: 0, neutral: 0 };
      dayBuckets[dateLabel][bucket] += 1;
    }

    const heatmap = Object.entries(dayBuckets).map(([date, counts]) => {
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      return { date, dominant, counts };
    });

    // --- Theme frequency, for the recommendation prompt + a chip list
    const themeCounts = {};
    for (const e of entries) {
      for (const t of e.themes) themeCounts[t] = (themeCounts[t] || 0) + 1;
    }
    const topThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t);

    // --- Dominant mood over the window, for the recommendation
    const moodCounts = {};
    for (const e of entries) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    const dominantMood =
      Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    // --- Blurb: sourced from memory summaries (requirement 5c), not raw entries
    const memoryContext = await loadMemoryContext(req.uid);
    const blurb =
      memoryContext.recent || memoryContext.archive
        ? `${memoryContext.recent} ${memoryContext.archive}`.trim()
        : "You haven't journaled enough yet for a pattern summary — a few more entries and this will fill in.";

    // --- Recommendation: best-effort, never blocks the rest of the dashboard
    let recommendation = null;
    if (entries.length > 0) {
      const rec = await generateJsonObject(recommendationPrompt(dominantMood, topThemes));
      if (rec) {
        recommendation = {
          message: rec.message,
          links: {
            youtubeMusic: rec.youtubeMusicQuery
              ? `https://music.youtube.com/search?q=${encodeURIComponent(rec.youtubeMusicQuery)}`
              : null,
            maps: rec.mapsQuery
              ? `https://www.google.com/maps/search/${encodeURIComponent(rec.mapsQuery)}`
              : null,
            search: rec.searchQuery
              ? `https://www.google.com/search?q=${encodeURIComponent(rec.searchQuery)}`
              : null,
          },
        };
      }
    }

    res.json({
      rangeDays,
      entryCount: entries.length,
      hourly, // [{worry,happy,neutral} x24] for the clock-face
      heatmap, // [{date, dominant, counts}] for the calendar heatmap
      topThemes,
      dominantMood,
      blurb,
      recommendation,
    });
  } catch (err) {
    console.error('[GET /api/dashboard/insights] failed for uid=%s:', req.uid, err.message);
    res.status(500).json({ error: 'Could not load your dashboard right now.' });
  }
});
