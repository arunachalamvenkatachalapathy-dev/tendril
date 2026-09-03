// src/secretManager.js
//
// Article 3 (Secret Management) of AI_STUDIO_CONSTITUTION.md:
// - The Gemini API key is fetched at runtime from Secret Manager using the
//   Cloud Run service account's own IAM identity (Application Default
//   Credentials) — no key files, no plaintext env var holding the secret.
// - Cached in memory after first successful fetch so we don't call Secret
//   Manager on every request, but a process restart re-fetches — this
//   supports rotation without requiring a redeploy (read the "latest"
//   version alias, not a pinned version).
// - Fails closed: if the secret can't be retrieved, callers must return a
//   503, not fall back to an empty/placeholder key.

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

let client = null;
function getSecretClient() {
  if (!client) {
    client = new SecretManagerServiceClient();
  }
  return client;
}

const PROJECT_ID = process.env.GCP_PROJECT_ID;
const SECRET_NAME = process.env.GEMINI_SECRET_NAME || 'GEMINI_API_KEY';

if (!PROJECT_ID && process.env.NODE_ENV === 'production') {
  // Fail fast at boot in production — this is a config error, not a runtime secret error.
  throw new Error(
    'GCP_PROJECT_ID env var is required in production (this is a project identifier, not a secret).'
  );
}

let cachedKey = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — bounds staleness after rotation

export async function getGeminiApiKey() {
  // Local development convenience override: strictly gated by NODE_ENV !== 'production'
  if (process.env.NODE_ENV !== 'production' && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  const isFresh = cachedKey && Date.now() - cachedAt < CACHE_TTL_MS;
  if (isFresh) return cachedKey;

  if (!PROJECT_ID) {
    throw new Error('GCP_PROJECT_ID env var is required to access Secret Manager.');
  }

  const name = `projects/${PROJECT_ID}/secrets/${SECRET_NAME}/versions/latest`;

  try {
    const smClient = getSecretClient();
    const [version] = await smClient.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString('utf8');
    if (!payload) {
      throw new Error('Secret Manager returned an empty payload.');
    }
    cachedKey = payload;
    cachedAt = Date.now();
    return cachedKey;
  } catch (err) {
    // Do not leak err details to callers; log server-side only.
    console.error('[secretManager] Failed to access secret:', err.message);
    // Fail closed — no fallback key, ever.
    throw new Error('SECRET_UNAVAILABLE');
  }
}
