// src/memory/pipeline.js
//
// Implements the now -> today -> recent -> archive layers described in
// MEMORY_AND_VOICE_ARCHITECTURE.md. Every function here takes an explicit
// `uid` argument and touches only `users/{uid}/memory/...` — no function
// in this file ever reads or writes more than one user's memory subtree
// in a single call (Article 9: no shared mutable accumulator across
// users during batch/scheduled runs).

import { db, FieldValue } from '../firebaseAdmin.js';
import { generateText, generateJsonArray } from '../gemini.js';
import {
  ideaExtractionPrompt,
  dailyCompactionPrompt,
  recentRollupPrompt,
  archiveMergePrompt,
} from './prompts.js';

function memoryDoc(uid, docId) {
  return db.collection('users').doc(uid).collection('memory').doc(docId);
}

function todayLabel(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/**
 * Requirement 6a: runs immediately after an entry is saved. Extracts 1-3
 * idea bullets from the entry and appends them to today's `now` buffer.
 * Best-effort: never throws — a failure here must not fail the entry
 * save it's attached to.
 */
export async function appendIdeasForEntry(uid, entry) {
  try {
    const prompt = ideaExtractionPrompt(entry.title, entry.summary, entry.messages);
    const ideas = await generateJsonArray(prompt);
    if (ideas.length === 0) return;

    const label = todayLabel();
    const ref = memoryDoc(uid, 'now');
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : { dateLabel: label, items: [] };

      // If "now" belongs to a previous day (e.g. daily compaction hasn't
      // run yet for some reason), start a fresh buffer rather than mixing
      // days together.
      const items = data.dateLabel === label ? data.items || [] : [];

      items.push({
        createdAt: new Date().toISOString(),
        mood: entry.mood || null,
        ideas,
      });

      tx.set(ref, { dateLabel: label, items, updatedAt: FieldValue.serverTimestamp() });
    });
  } catch (err) {
    console.error('[memory.appendIdeasForEntry] failed for uid=%s:', uid, err.message);
  }
}

/**
 * Returns { now, recent, archive } text/objects for injecting into a new
 * conversation's system instruction, and the raw idea bullets from today
 * for the "show ideas immediately" UI requirement.
 */
export async function loadMemoryContext(uid) {
  const [nowSnap, recentSnap, archiveSnap] = await Promise.all([
    memoryDoc(uid, 'now').get(),
    memoryDoc(uid, 'recent').get(),
    memoryDoc(uid, 'archive').get(),
  ]);

  const now = nowSnap.exists ? nowSnap.data() : { items: [] };
  const recentData = recentSnap.exists ? recentSnap.data() : null;
  const archiveData = archiveSnap.exists ? archiveSnap.data() : null;

  const todaysIdeas = now.bullets || (now.items || []).flatMap((i) => i.ideas || []);

  return {
    todaysIdeas,
    now: {
      bullets: todaysIdeas
    },
    recent: {
      summary: recentData?.summary || '',
      topics: recentData?.topics || []
    },
    archive: {
      summary: archiveData?.summary || '',
      values: archiveData?.values || []
    }
  };
}

export function buildSystemPreamble({ recent, archive }) {
  const recentText = typeof recent === 'string' ? recent : (recent?.summary || '');
  const archiveText = typeof archive === 'string' ? archive : (archive?.summary || '');
  if (!recentText && !archiveText) return '';
  return `Context from the user's own past journal entries, for
continuity only — never quote it back verbatim unless the user brings it
up, and never treat it as more certain than what the user says right now.

RECENT (last ~7 days): ${recentText || '(none yet)'}

LONGER-TERM: ${archiveText || '(none yet)'}`;
}

/**
 * Daily compaction, step 1: now -> today-{date}. Intended to run once per
 * day per active uid via the Cloud Scheduler job (see routes/internal.js).
 */
export async function compactNowToToday(uid) {
  const nowRef = memoryDoc(uid, 'now');
  const nowSnap = await nowRef.get();
  if (!nowSnap.exists) return { compacted: false };

  const data = nowSnap.data();
  const items = data.items || [];
  if (items.length === 0) return { compacted: false };

  const dateLabel = data.dateLabel || todayLabel();
  const summary = await generateText(dailyCompactionPrompt(dateLabel, items));

  const todayRef = memoryDoc(uid, `today-${dateLabel}`);
  await todayRef.set({
    date: dateLabel,
    summary,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Clear "now" so tomorrow starts fresh.
  await nowRef.delete();

  return { compacted: true, dateLabel };
}

/**
 * Daily compaction, step 2: roll up the last ~7 `today-*` docs into
 * `recent`, and merge anything older than 7 days into `archive`, then
 * delete the aged-out `today-*` docs so storage doesn't grow unbounded.
 */
export async function rollupRecentAndArchive(uid) {
  const todaySnaps = await db
    .collection('users')
    .doc(uid)
    .collection('memory')
    .where('date', '!=', null) // only today-* docs have a `date` field
    .get();

  const dailyDocs = todaySnaps.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffLabel = todayLabel(cutoff);

  const recentDocs = dailyDocs.filter((d) => d.date >= cutoffLabel);
  const agingDocs = dailyDocs.filter((d) => d.date < cutoffLabel);

  if (recentDocs.length > 0) {
    const recentSummary = await generateText(recentRollupPrompt(recentDocs));
    await memoryDoc(uid, 'recent').set({
      summary: recentSummary,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  if (agingDocs.length > 0) {
    const archiveSnap = await memoryDoc(uid, 'archive').get();
    const existingArchive = archiveSnap.exists ? archiveSnap.data().summary : '';

    const mergedArchive = await generateText(archiveMergePrompt(existingArchive, agingDocs));
    await memoryDoc(uid, 'archive').set({
      summary: mergedArchive,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Delete the now-archived daily docs to keep the memory subtree small.
    const batch = db.batch();
    for (const d of agingDocs) {
      batch.delete(memoryDoc(uid, d.id));
    }
    await batch.commit();
  }

  return { recentCount: recentDocs.length, archivedCount: agingDocs.length };
}

/**
 * Discovers which uids have a pending `now` buffer to compact, via a
 * Firestore collection-group query. Used only by the scheduled internal
 * job (routes/internal.js) — never exposed to a per-user request, so a
 * user can never trigger a cross-user scan themselves (Article 9).
 *
 * Requires a Firestore collection-group index on `memory` for field
 * `dateLabel` (Firestore will emit a console link to auto-create it on
 * first run if missing — see DEPLOY.md).
 */
export async function getUidsWithPendingNow() {
  const snap = await db.collectionGroup('memory').where('dateLabel', '!=', null).get();
  const uids = new Set();
  for (const doc of snap.docs) {
    if (doc.id !== 'now') continue; // dateLabel only appears on the `now` doc
    uids.add(doc.ref.parent.parent.id);
  }
  return [...uids];
}

/**
 * Discovers which uids have any `today-*` docs eligible for rollup.
 * Same isolation note as above.
 */
export async function getUidsWithTodayDocs() {
  const snap = await db.collectionGroup('memory').where('date', '!=', null).get();
  const uids = new Set();
  for (const doc of snap.docs) {
    uids.add(doc.ref.parent.parent.id);
  }
  return [...uids];
}
