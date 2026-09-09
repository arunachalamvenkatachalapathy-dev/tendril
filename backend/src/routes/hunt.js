// src/routes/hunt.js
//
// AI-powered Hunt: searches across entries, voice transcripts, and memory context
// using Gemini to synthesize answers and return relevant ideas and moments.

import { Router } from 'express';
import { db } from '../firebaseAdmin.js';
import { loadMemoryContext } from '../memory/pipeline.js';
import { generateJsonObject } from '../gemini.js';

export const huntRouter = Router();

huntRouter.post('/hunt', async (req, res) => {
  try {
    const { query, scope = 'all' } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const cleanQuery = query.trim();

    // 1. Fetch user's entries (up to 50)
    const snap = await db
      .collection('users')
      .doc(req.uid)
      .collection('entries')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const entries = snap.docs.map((doc) => {
      const data = doc.data();
      const dateStr = data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Recent';

      const fullText = (data.messages || []).map((m) => `${m.role}: ${m.text}`).join(' ');

      return {
        id: doc.id,
        title: data.title || 'Untitled Reflection',
        summary: data.summary || '',
        mood: data.mood || 'neutral',
        themes: data.themes || [],
        actionItems: data.actionItems || [],
        date: dateStr,
        fullText: fullText.slice(0, 1500),
      };
    });

    // 2. Fetch memory context
    const memoryContext = await loadMemoryContext(req.uid).catch(() => ({}));
    const todaysIdeas = memoryContext.todaysIdeas || [];
    const recentSummary = typeof memoryContext.recent === 'string'
      ? memoryContext.recent
      : (memoryContext.recent?.summary || '');
    const archiveSummary = typeof memoryContext.archive === 'string'
      ? memoryContext.archive
      : (memoryContext.archive?.summary || '');

    // 3. Synthesize with Gemini
    const contextPrompt = `You are Tendril's AI Hunt Engine. The user is searching their journal memory with the query: "${cleanQuery}" (scope: ${scope}).

Journal Entries available:
${entries.length > 0 ? entries.slice(0, 12).map((e) => `[ID: ${e.id}] (${e.date}) ${e.title} (Mood: ${e.mood}, Themes: ${e.themes.join(', ')}): ${e.summary} Excerpt: ${e.fullText.slice(0, 250)}`).join('\n\n') : '(No saved entries yet)'}

Memory Context:
- Today's Sparks: ${todaysIdeas.join('; ') || 'none'}
- Recent 7-Day Context: ${recentSummary || 'none'}
- Core Themes/Archive: ${archiveSummary || 'none'}

Analyze their records and synthesize a targeted, insightful discovery report.
Return ONLY valid JSON matching this schema:
{
  "answer": "A direct, personal, and conversational 2-4 sentence synthesis directly addressing their query based on their actual journal records. If nothing matches, explain kindly what is present.",
  "matchedIdeas": [
    { "text": "Specific idea or takeaway relevant to query", "relevance": "high" }
  ],
  "matchedEntries": [
    { "entryId": "ID matching above entries", "title": "entry title", "date": "entry date", "snippet": "Specific quote or excerpt addressing the query", "mood": "entry mood" }
  ],
  "relatedThemes": ["theme1", "theme2"],
  "suggestedFollowUps": ["query 1", "query 2"]
}`;

    const discovery = await generateJsonObject(contextPrompt);
    if (!discovery) {
      return res.json({
        answer: `I searched through your entries for "${cleanQuery}" but couldn't synthesize a connection right now.`,
        matchedIdeas: [],
        matchedEntries: [],
        relatedThemes: [],
        suggestedFollowUps: [],
      });
    }

    res.json({
      answer: discovery.answer || '',
      matchedIdeas: Array.isArray(discovery.matchedIdeas) ? discovery.matchedIdeas.slice(0, 6) : [],
      matchedEntries: Array.isArray(discovery.matchedEntries) ? discovery.matchedEntries.slice(0, 8) : [],
      relatedThemes: Array.isArray(discovery.relatedThemes) ? discovery.relatedThemes.slice(0, 6) : [],
      suggestedFollowUps: Array.isArray(discovery.suggestedFollowUps) ? discovery.suggestedFollowUps.slice(0, 4) : [],
    });
  } catch (err) {
    console.error('[POST /api/hunt] failed for uid=%s:', req.uid, err.message);
    res.status(500).json({ error: 'Hunt search failed right now.' });
  }
});
