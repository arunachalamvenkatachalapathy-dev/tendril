// src/memory/prompts.js
//
// Article 9: compression preserves meaning and concrete detail — it must
// not fabricate content, and must not collapse into generic one-liners
// that lose the nuance the user asked for.

export function ideaExtractionPrompt(entryTitle, entrySummary, entryMessages) {
  const transcript = entryMessages.map((m) => `${m.role}: ${m.text}`).join('\n');
  return `From this single journal/brainstorm entry, extract 1-3 short
"idea" bullets — concrete thoughts, plans, or open threads worth
remembering (not a mood, not a generic summary). Each bullet under 15
words. Return ONLY a JSON array of strings, nothing else.

Entry title: ${entryTitle}
Entry summary: ${entrySummary}
Transcript:
${transcript}`;
}

export function dailyCompactionPrompt(dateLabel, nowEntries) {
  const bulletBlock = nowEntries
    .map((e) => `- [${e.createdAt}] (${e.mood || 'n/a'}) ${e.ideas.join(' / ')}`)
    .join('\n');
  return `Compress today's (${dateLabel}) journal activity into a short
paragraph (3-6 sentences) a future conversation can use for continuity.
Preserve CONCRETE nuance: specific projects, people, decisions, or
worries mentioned — do not generalize into vague mood language only. Do
not invent anything not implied by the bullets below.

Today's idea bullets:
${bulletBlock}

Return ONLY the paragraph, no preamble.`;
}

export function recentRollupPrompt(dailySummaries) {
  const block = dailySummaries.map((d) => `[${d.date}] ${d.summary}`).join('\n\n');
  return `Consolidate these daily summaries from the last ~7 days into one
short "recent context" passage (5-8 sentences) that a journaling
companion can read at the start of a new conversation to have continuity
with the user. Preserve specific recurring themes, names, and open
threads. Do not invent details.

Daily summaries:
${block}

Return ONLY the passage, no preamble.`;
}

export function archiveMergePrompt(existingArchive, agingDailySummaries) {
  const block = agingDailySummaries.map((d) => `[${d.date}] ${d.summary}`).join('\n\n');
  return `You maintain a long-term memory passage for a journaling app.
Merge the existing archive below with the newly-aging daily summaries
into one updated archive passage (8-14 sentences). Keep it information-
dense: recurring people, ongoing projects, long-running themes, and
significant past events. Drop detail that has become irrelevant/stale
rather than growing without bound. Do not invent details.

Existing archive:
${existingArchive || '(none yet)'}

Newly-aging daily summaries to merge in:
${block}

Return ONLY the updated archive passage, no preamble.`;
}
