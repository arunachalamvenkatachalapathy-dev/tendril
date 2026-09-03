// src/routes/journal.js
//
// Every route here follows the Article 5 sequence:
//   verify auth -> validate input -> authorize (uid match) -> act -> respond
//
// req.uid is set by requireAuth middleware from a VERIFIED Firebase ID
// token. It is the only identity ever used to scope Firestore reads/writes.
// Nothing here ever reads a uid from req.body, req.query, or req.params.

import { Router } from 'express';
import { db, FieldValue } from '../firebaseAdmin.js';
import { chatReply, summarizeConversation } from '../gemini.js';
import { validateConversationPayload, validateSavePayload } from '../validate.js';
import { loadMemoryContext, buildSystemPreamble, appendIdeasForEntry } from '../memory/pipeline.js';

export const journalRouter = Router();

// POST /api/chat — one turn of the multi-turn conversation. Not persisted
// until the user explicitly saves (POST /api/entries).
journalRouter.post('/chat', async (req, res) => {
  const validation = validateConversationPayload(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const { message, history = [] } = req.body;
    // Continuity: fold in the user's own recent/archive memory (Article 9)
    // so a brand-new session already has context, not a blank slate.
    const memoryContext = await loadMemoryContext(req.uid).catch(() => null);
    const preamble = memoryContext ? buildSystemPreamble(memoryContext) : '';
    const reply = await chatReply(history, message, preamble);
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
    const { title, summary, mood, themes } = await summarizeConversation(messages);

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
