// src/memory/dashboardPrompts.js

export function recommendationPrompt(dominantMood, recentThemes) {
  return `The user's dominant recent journal mood is "${dominantMood}".
Recent themes: ${recentThemes.join(', ') || '(none)'}.

If the mood is on the difficult side (stressed, frustrated, sad, anxious),
suggest ONE gentle, low-effort thing that might help them feel a bit
better right now — something like a calming music search, a short walk
idea, or a grounding search topic. If the mood is positive (happy,
excited, hopeful, calm), suggest ONE thing that could extend or celebrate
that feeling — an upbeat playlist idea, an outing idea, or something fun
to look up.

Return ONLY a JSON object with exactly these fields:
{
  "message": "one warm, brief sentence (under 25 words) framing the suggestion",
  "youtubeMusicQuery": "a short search phrase for YouTube Music, or null",
  "mapsQuery": "a short search phrase for Google Maps, or null",
  "searchQuery": "a short search phrase for Google Search, or null"
}
Use null for any field that doesn't apply — don't force all three.`;
}

export function actionItemsPrompt(dominantMood, topThemes, recentSummary) {
  return `You are a thoughtful journaling coach analyzing someone's journal patterns.

Dominant mood: "${dominantMood}"
Recurring themes: ${topThemes.join(', ') || '(none)'}
Recent context: ${recentSummary || '(none)'}

Generate 3-5 concrete, specific action items this person could actually take
based on their real journal patterns — not generic wellness advice.
Each action must be clearly motivated by something from their themes/context.

Return ONLY a JSON array (no wrapper object), each item:
{
  "title": "Actionable verb phrase, max 7 words",
  "description": "One specific sentence (max 18 words) grounded in their context",
  "category": one of "reflect" | "schedule" | "move" | "connect" | "explore" | "rest",
  "calendarText": "Short Google Calendar event text if it's schedulable, else null",
  "searchQuery": "Google search query if it's an explore action, else null"
}`;
}
