// src/routes/journal.js
//
// Every route here follows the Article 5 sequence:
//   verify auth -> validate input -> authorize (uid match) -> act -> respond
//
// req.uid is set by requireAuth middleware from a VERIFIED Firebase ID
// token. It is the only identity ever used to scope Firestore reads/writes.
// Nothing here ever reads a uid from req.body, req.query, or req.params.

import { Router } from 'express';
import { db, FieldValue, Timestamp } from '../firebaseAdmin.js';
import { chatReply, summarizeConversation, extractIdeasFromText } from '../gemini.js';
import { validateConversationPayload, validateSavePayload } from '../validate.js';
import { loadMemoryContext, buildSystemPreamble, appendIdeasForEntry } from '../memory/pipeline.js';

export const journalRouter = Router();

// POST /api/ideas/extract — Real-time idea distillation from active user turns
journalRouter.post('/ideas/extract', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return res.json({ ideas: [] });
    }
    const ideas = await extractIdeasFromText(text);
    res.json({ ideas });
  } catch (err) {
    console.error('[POST /api/ideas/extract] failed:', err.message);
    res.json({ ideas: [] });
  }
});

// POST /api/chat — one turn of the multi-turn conversation. Not persisted
// until the user explicitly saves (POST /api/entries).
journalRouter.post('/chat', async (req, res) => {
  const validation = validateConversationPayload(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const { message, history = [], image } = req.body;
    // Continuity: fold in the user's own recent/archive memory (Article 9)
    // so a brand-new session already has context, not a blank slate.
    const memoryContext = await loadMemoryContext(req.uid).catch(() => null);
    const preamble = memoryContext ? buildSystemPreamble(memoryContext) : '';
    const reply = await chatReply(history, message, preamble, image);
    res.json({ reply });
  } catch (err) {
    console.error('[POST /api/chat] failed for uid=%s:', req.uid, err.message);
    if (err.message === 'SECRET_UNAVAILABLE') {
      return res.status(503).json({ error: 'Journal companion is temporarily unavailable.' });
    }
    res.status(502).json({ error: 'Journal companion is temporarily unavailable.' });
  }
});

// POST /api/entries — summarize + save the finished conversation, scoped
// to the verified uid only.
journalRouter.post('/entries', async (req, res) => {
  const validation = validateSavePayload(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const { messages } = req.body;
    const summaryObj = await summarizeConversation(messages);
    const { title, summary, mood, themes, cognitiveReframing = '', actionItems = [] } = summaryObj;

    const entryRef = db
      .collection('users')
      .doc(req.uid) // <-- verified uid, never from the client
      .collection('entries')
      .doc();

    const entry = {
      title,
      summary,
      mood,
      themes,
      cognitiveReframing,
      actionItems,
      messages,
      createdAt: FieldValue.serverTimestamp(),
    };

    await entryRef.set(entry);

    // Requirement 6a: extract idea bullets immediately, don't wait for the
    // nightly job. Fire-and-forget — appendIdeasForEntry never throws and
    // must not delay the save response back to the user.
    appendIdeasForEntry(req.uid, { title, summary, mood, messages });

    res.status(201).json({ id: entryRef.id, ...entry, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error('[POST /api/entries] failed for uid=%s:', req.uid, err.message);
    if (err.message === 'SECRET_UNAVAILABLE') {
      return res.status(503).json({ error: 'Could not reach the summarizer. Try again shortly.' });
    }
    res.status(502).json({ error: 'Could not save this entry. Try again shortly.' });
  }
});

// POST /api/demo/seed — Seeds a rich 14-day sample journal journey for judges
journalRouter.post('/demo/seed', async (req, res) => {
  try {
    const batch = db.batch();
    const entriesCol = db.collection('users').doc(req.uid).collection('entries');

    const sampleJourneys = [
      {
        daysAgo: 13,
        hour: 8,
        minute: 20,
        title: 'Dawn of Tendril Architecture',
        summary: 'Mapped the foundational zero-trust security model. Determined that Gemini API keys must never touch the browser, choosing Secret Manager with Cloud Run service account ADC.',
        mood: 'energized',
        themes: ['tendril', 'architecture', 'security'],
        cognitiveReframing: 'Initial doubt about deadline pressure is replaced with clarity by breaking security into enforceable layers.',
        actionItems: ['Write AI Studio Constitution', 'Bind SecretAccessor IAM role'],
        messages: [
          { role: 'user', text: 'I am sketching out the security model for Tendril. How do I guarantee zero key leakage?' },
          { role: 'assistant', text: 'Decouple client identity from privileged API calls. Use Firebase Auth ID tokens for client verification and Cloud Secret Manager for server-side Gemini invocation.' },
        ],
      },
      {
        daysAgo: 11,
        hour: 14,
        minute: 45,
        title: 'Deep Work on Live Voice Relay',
        summary: 'Encountered WebSocket frame downsampling challenges. Successfully downsampled client audio to 16kHz PCM16 for native Gemini Live streaming.',
        mood: 'focused',
        themes: ['gemini-live', 'websockets', 'audio'],
        cognitiveReframing: 'Complex audio protocol hurdles are stepping stones to mastering real-time bidirectional streaming.',
        actionItems: ['Test 16kHz capture on Chrome', 'Verify audio visualizer bounce'],
        messages: [
          { role: 'user', text: 'The browser AudioContext default is 44.1kHz or 48kHz, but Gemini Live expects 16kHz.' },
          { role: 'assistant', text: 'Downsample in a dedicated AudioWorklet or ScriptProcessor to 16,000 samples per second before transmitting binary frames over WebSocket.' },
        ],
      },
      {
        daysAgo: 9,
        hour: 23,
        minute: 10,
        title: 'Midnight Overthinking on Delivery',
        summary: 'Felt overwhelmed by the scope of Hack2Skill deliverables. Realized that building clean, defensible architecture matters more than adding superficial bloat.',
        mood: 'anxious',
        themes: ['well-being', 'mindset', 'deadlines'],
        cognitiveReframing: 'Overwhelm is a signal of caring about craftsmanship. Focus on one verified deliverable at a time.',
        actionItems: ['Sleep 8 hours tonight', 'Review Firestore rules simulator tomorrow morning'],
        messages: [
          { role: 'user', text: 'I feel like I am running out of time and trying to build too much at once.' },
          { role: 'assistant', text: 'Take a deep breath. Your core security and memory architecture is already enterprise-grade. Quality and calm execution always win over hurried complexity.' },
        ],
      },
      {
        daysAgo: 7,
        hour: 9,
        minute: 15,
        title: 'Layered Memory Engine Rollup',
        summary: 'Adapted the claude-remember 3-tier memory model into Firestore collections. Designed automated daily rollups into recent and permanent archive themes.',
        mood: 'hopeful',
        themes: ['memory', 'claude-remember', 'firestore'],
        cognitiveReframing: 'Bridging LLM context window limits with autonomous compaction gives the companion genuine continuity.',
        actionItems: ['Setup Cloud Scheduler daily job', 'Verify OIDC trust path'],
        messages: [
          { role: 'user', text: 'How do we store memories across days without blowing token limits?' },
          { role: 'assistant', text: 'Use a 3-tier hierarchy: ephemeral now buffer, rolling 7-day distilled synthesis, and permanent core value archives.' },
        ],
      },
      {
        daysAgo: 5,
        hour: 16,
        minute: 30,
        title: 'Circadian Diurnal Rhythm Synthesis',
        summary: 'Observed that mental energy peaks sharply between 8 AM and 11 AM, while creative self-reflection flows best after 9 PM. Built the 24h diurnal clock.',
        mood: 'excited',
        themes: ['circadian', 'analytics', 'habits'],
        cognitiveReframing: 'Recognizing natural biological rhythms eliminates artificial guilt about afternoon fatigue.',
        actionItems: ['Schedule deep coding for morning slots', 'Reserve late afternoons for review'],
        messages: [
          { role: 'user', text: 'I notice I struggle to write code at 3 PM but fly through it at 9 AM.' },
          { role: 'assistant', text: 'That is the natural postprandial dip in your circadian rhythm. Protect your morning peak for deep synthesis.' },
        ],
      },
      {
        daysAgo: 3,
        hour: 11,
        minute: 0,
        title: 'Double-Bezel Hardware UI Breakthrough',
        summary: 'Overhauled the frontend into a dark OLED luxury interface with concentric double bezels, floating navigation island, and live idea vault.',
        mood: 'happy',
        themes: ['design', 'ui-ux', 'tendril'],
        cognitiveReframing: 'Great visual design conveys the invisible engineering rigor underneath.',
        actionItems: ['Verify mobile responsiveness', 'Test high contrast OLED readability'],
        messages: [
          { role: 'user', text: 'Standard AI templates look cheap. Tendril needs to look like a $150k bespoke digital companion.' },
          { role: 'assistant', text: 'Implement concentric hardware bezels, Syne typography, glowing neural orbs, and fluid motion physics.' },
        ],
      },
      {
        daysAgo: 1,
        hour: 10,
        minute: 15,
        title: 'APAC Ideathon Final Polish',
        summary: 'Verified end-to-end data isolation across separate Google accounts. Verified Cloud Run zero key leakage and published the public GitHub repository.',
        mood: 'energized',
        themes: ['hackathon', 'milestone', 'launch'],
        cognitiveReframing: 'Preparation and technical honesty turn stressful evaluations into rewarding demonstrations.',
        actionItems: ['Record demo video walkthrough', 'Submit Hack2Skill form'],
        messages: [
          { role: 'user', text: 'We are in the final countdown for submission.' },
          { role: 'assistant', text: 'Everything is deployed, isolated, and verified. Stand proud behind your engineering!' },
        ],
      },
    ];

    for (const s of sampleJourneys) {
      const docRef = entriesCol.doc();
      const entryDate = new Date();
      entryDate.setDate(entryDate.getDate() - s.daysAgo);
      entryDate.setHours(s.hour, s.minute, 0, 0);

      batch.set(docRef, {
        title: s.title,
        summary: s.summary,
        mood: s.mood,
        themes: s.themes,
        cognitiveReframing: s.cognitiveReframing,
        actionItems: s.actionItems,
        messages: s.messages,
        createdAt: Timestamp.fromDate(entryDate),
      });
    }

    // Also populate rich memory tiers for demonstration
    const recentRef = db.collection('users').doc(req.uid).collection('memory').doc('recent');
    batch.set(recentRef, {
      summary: 'Actively engineering Tendril AI for the Google Cloud GenAI Academy APAC Ideathon. Deeply engaged in zero-trust architecture, diurnal mood mapping, and multi-tier memory compaction.',
      topics: ['tendril-ai', 'cloud-run-deployment', 'secret-manager', 'circadian-habits', 'claude-remember'],
      updatedAt: Timestamp.now(),
    });

    const archiveRef = db.collection('users').doc(req.uid).collection('memory').doc('archive');
    batch.set(archiveRef, {
      summary: 'Engineering philosophy centered on radical user data sovereignty, aesthetic visual craftsmanship, and biological harmony.',
      values: ['Zero-Trust Security', 'Data Sovereignty', 'Diurnal Rhythm Alignment', 'Craftsmanship'],
      updatedAt: Timestamp.now(),
    });

    const nowRef = db.collection('users').doc(req.uid).collection('memory').doc('now');
    batch.set(nowRef, {
      bullets: [
        'Fine-tuning cognitive reframing cards for judges',
        'Validating 24-hour diurnal clock distribution',
        'Finalizing Hack2Skill submission checklist'
      ],
      updatedAt: Timestamp.now(),
    });

    await batch.commit();
    res.json({ success: true, count: sampleJourneys.length });
  } catch (err) {
    console.error('[POST /api/demo/seed] failed:', err);
    res.status(500).json({ error: 'Failed to seed sample journey' });
  }
});

// GET /api/entries — list the CALLER's own entries, newest first. There is
// no route that accepts a uid parameter to look up someone else's entries.
journalRouter.get('/entries', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);

    const snap = await db
      .collection('users')
      .doc(req.uid) // <-- verified uid, never from the client
      .collection('entries')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const entries = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        summary: data.summary,
        mood: data.mood,
        themes: data.themes,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
      };
    });

    res.json({ entries });
  } catch (err) {
    console.error('[GET /api/entries] failed for uid=%s:', req.uid, err.message);
    res.status(500).json({ error: 'Could not load your entries right now.' });
  }
});

// GET /api/entries/:id — a single entry WITH its full transcript. Ownership
// is enforced by only ever reading from users/{req.uid}/entries/{id} — a
// caller can never supply another user's uid, so this can't leak.
journalRouter.get('/entries/:id', async (req, res) => {
  try {
    const doc = await db
      .collection('users')
      .doc(req.uid)
      .collection('entries')
      .doc(req.params.id)
      .get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    const data = doc.data();
    res.json({
      id: doc.id,
      ...data,
      createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    });
  } catch (err) {
    console.error('[GET /api/entries/:id] failed for uid=%s:', req.uid, err.message);
    res.status(500).json({ error: 'Could not load this entry right now.' });
  }
});
