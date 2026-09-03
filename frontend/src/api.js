// src/api.js
//
// Thin wrapper around our own backend. Note what's absent: no Gemini
// import, no API key, no direct Firestore writes for entries. Every
// privileged action goes through the backend with the user's Firebase ID
// token attached, per Article 2.

import { getIdToken } from './firebase.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function authedFetch(path, options = {}) {
  const token = await getIdToken();
  if (!token) throw new Error('Not signed in.');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  return res.json();
}

export function sendChatMessage(message, history, image = null) {
  return authedFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history, image }),
  });
}

export function saveEntry(messages) {
  return authedFetch('/api/entries', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}

export function seedDemoData() {
  return authedFetch('/api/demo/seed', {
    method: 'POST',
  });
}

export function wipeAllMemory() {
  return authedFetch('/api/memory', {
    method: 'DELETE',
  });
}

export function listEntries(limit = 30) {
  return authedFetch(`/api/entries?limit=${limit}`);
}

export function getEntry(id) {
  return authedFetch(`/api/entries/${id}`);
}

export function getMemoryContext() {
  return authedFetch('/api/memory/context');
}

export function getDashboardInsights(days = 30) {
  return authedFetch(`/api/dashboard/insights?days=${days}`);
}

/**
 * Builds the voice WebSocket URL from VITE_API_BASE_URL (http(s):// -> ws(s)://).
 * The token itself is sent as the FIRST WebSocket message (see
 * components/VoiceComposer.jsx), never embedded in the URL, so it doesn't
 * end up in server access logs or browser history.
 */
export function buildVoiceWsUrl() {
  const wsBase = BASE_URL.replace(/^http/, 'ws');
  return `${wsBase}/ws/voice`;
}
