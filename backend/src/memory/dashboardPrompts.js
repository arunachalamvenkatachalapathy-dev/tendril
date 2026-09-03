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
