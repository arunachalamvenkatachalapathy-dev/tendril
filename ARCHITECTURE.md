# Architecture — Personal Gemini Journal

## 1. System overview

```
┌─────────────────────┐      ┌──────────────────────────────────┐      ┌────────────────┐
│   Browser (React)   │      │        Cloud Run (Express)        │      │  Google Cloud   │
│                      │      │                                    │      │                 │
│  Firebase Auth SDK   │─────▶│  1. verifyIdToken(Authorization)  │      │  Secret Manager │
│  (Google sign-in)    │ ID   │  2. validate + size-check input   │─────▶│  GEMINI_API_KEY │
│                      │ token│  3. call Gemini with server key   │      │                 │
│  Journal UI          │      │  4. summarize + tag mood/theme    │      │  Gemini API     │
│  (chat + entries +   │◀─────│  5. write to Firestore, scoped    │─────▶│                 │
│   mood trend)        │ JSON │     to verified uid only          │      │                 │
└──────────┬───────────┘      └──────────────┬─────────────────────┘      └────────────────┘
           │                                  │
           │ reads own entries only           │ Admin SDK, service-account scoped
           ▼                                  ▼
   ┌───────────────────────────────────────────────┐
   │                Cloud Firestore                 │
   │   users/{uid}/entries/{entryId}                │
   │   Security Rules: request.auth.uid == uid       │
   └───────────────────────────────────────────────┘
```

The frontend **never** calls Gemini directly and **never** holds the Gemini
API key. It only ever talks to (a) Firebase Auth, for sign-in, and (b) our
own Cloud Run backend, authenticated with a Firebase ID token. Firestore
reads for the entry list also go through the backend (not directly from the
client SDK) so the mood-trend aggregation and pagination logic stay
server-side and consistent — though the Firestore rules below are written to
independently block cross-user access even if that changes later.

## 2. Threat model summary (see `AI_STUDIO_CONSTITUTION.md` Article 1 for the full method)

| Actor | Can reach | Must NOT be able to reach |
|---|---|---|
| Anonymous visitor | Login page, static assets | Any `/api/*` route, any Firestore data |
| Authenticated user A | Their own `/api/chat`, `/api/entries` results | User B's entries, the raw Gemini key, other users' uids |
| Authenticated user B | Same as A, for their own data | User A's entries — enforced by verified-uid scoping + Firestore rules |
| Attacker with a stolen/expired token | Nothing — `verifyIdToken` rejects expired/invalid tokens with 401 | — |
| Attacker with browser devtools access | Public Firebase config (by design, not a secret) | The Gemini API key (never shipped to the client) |
| Cloud Run service account | The one named Secret Manager secret (`secretAccessor` role only), Firestore via ADC | Other GCP projects' secrets, broad IAM roles |

## 3. Data model (Firestore)

```
users/{uid}/entries/{entryId}
  ├─ createdAt: Timestamp
  ├─ title: string                     (derived from first user message)
  ├─ messages: [{ role, text, ts }]    (full multi-turn transcript)
  ├─ summary: string                   (Gemini-generated)
  ├─ mood: string                      (enum: e.g. "calm","stressed","hopeful","frustrated","neutral","excited","sad")
  └─ themes: string[]                  (1-3 short keywords, Gemini-generated)
```

No top-level `entries` collection, no `users` document containing other
users' data, no fan-out writes outside the owning `uid`'s subtree.

## 4. Request lifecycle for `POST /api/chat`

1. Client sends `{ conversation: [...], journalMode: true }` with header
   `Authorization: Bearer <Firebase ID token>`.
2. Backend middleware `requireAuth` verifies the token via
   `admin.auth().verifyIdToken()`; attaches `req.uid` from the **verified**
   token. Rejects with 401 otherwise.
3. Input validation: conversation array bounded in length and per-message
   character count; reject malformed payloads with 400.
4. Backend fetches the Gemini key from Secret Manager (cached after first
   fetch) and calls the Gemini API server-side.
5. On the "save" action, backend also asks Gemini for a structured
   summary + mood + themes (JSON-constrained response), then writes the
   entry to `users/{req.uid}/entries/{entryId}` — `req.uid` always comes
   from step 2, never from the request body.
6. Response returns only the data the client needs — no internal error
   detail, no raw provider payloads.

## 5. Deployment topology

- **Frontend**: static React/Vite build → Firebase Hosting.
- **Backend**: containerized Express app → Cloud Run (min instances 0,
  scales to zero when idle — good fit for a hackathon/demo budget).
- **Secrets**: `GEMINI_API_KEY` in Secret Manager; Cloud Run service
  account granted `roles/secretmanager.secretAccessor` on that secret only.
- **Firestore**: native mode, security rules deployed via `firebase deploy
  --only firestore:rules`.

## 6. Phase 3 enhancement — Mood & Theme Trends

Beyond the base spec, every saved entry is auto-tagged with a `mood` and up
to 3 `themes` via a structured (JSON schema-constrained) Gemini call at
save time. The frontend renders a lightweight trend strip showing mood over
the user's last N entries and a "frequent themes" chip list — turning raw
journal logs into a small reflective insight surface, without adding any
new data-isolation surface area (it's derived entirely from the user's own
already-isolated entries).
