# Tendril — Living Neural Memory & Ambient Voice Companion

An authenticated, production-grade intelligence environment where you converse, brainstorm, or reflect — by ambient multimodal voice or flow text — with Gemini. Every conversation is automatically summarized, mood-tagged, and saved into strictly isolated storage. Tendril features a 3-tier persistent memory pipeline (adapted from `claude-remember`), real-time idea extraction, circadian diurnal telemetry, and a mood-linked recommendation engine. Built for the **Hack2Skill Google Cloud Gen AI Academy APAC Edition (Cohort 3) Ideathon Challenge**.

## Deliverables map

| Challenge requirement | Where it lives |
|---|---|
| **Phase 1** — Google AI Studio security constitution | [`AI_STUDIO_CONSTITUTION.md`](./AI_STUDIO_CONSTITUTION.md) (Articles 1-7 core spec, Articles 8-9 cover voice + memory) |
| **Phase 2** — User Authentication (Firebase) | `frontend/src/firebase.js`, `frontend/src/components/Login.jsx` |
| **Phase 2** — Multi-turn Gemini conversations (text) | `backend/src/gemini.js` (`chatReply`), `frontend/src/components/EntryComposer.jsx` |
| **Phase 2** — Isolated Cloud Firestore storage | `backend/src/routes/journal.js` (every query scoped to verified `req.uid`) + [`firestore.rules`](./firestore.rules) as an independent enforcement layer |
| **Phase 2** — Secret Manager key retrieval | `backend/src/secretManager.js` |
| **Phase 3** — Voice agent (Gemini Live API) | `backend/src/live/liveRelay.js`, `frontend/src/voice/useVoiceSession.js`, `frontend/src/components/VoiceComposer.jsx` |
| **Phase 3** — Layered continuity memory (now/today/recent/archive) | `backend/src/memory/pipeline.js`, `backend/src/routes/internal.js` (Cloud Scheduler jobs) |
| **Phase 3** — Mood/theme trend + patterns dashboard | `backend/src/routes/dashboard.js`, `frontend/src/components/Dashboard.jsx`, `ClockChart.jsx`, `HeatmapCalendar.jsx` |
| **Phase 3** — Mood-linked recommendations | `backend/src/memory/dashboardPrompts.js`, `frontend/src/components/RecommendationCard.jsx` |
| Architecture / threat model | [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`MEMORY_AND_VOICE_ARCHITECTURE.md`](./MEMORY_AND_VOICE_ARCHITECTURE.md) |
| Deploy steps | [`DEPLOY.md`](./DEPLOY.md) |

## Repo layout

```
.
├── AI_STUDIO_CONSTITUTION.md          ← Phase 1: paste into AI Studio custom instructions
├── ARCHITECTURE.md                    ← core system diagram + threat model
├── MEMORY_AND_VOICE_ARCHITECTURE.md   ← layered memory + voice architecture
├── DEPLOY.md                          ← exact gcloud/firebase commands
├── firebase.json / firestore.rules / firestore.indexes.json
├── backend/                           ← Express + WebSocket API on Cloud Run
│   └── src/
│       ├── server.js                  ← CORS, route wiring, voice relay attach
│       ├── firebaseAdmin.js           ← Admin SDK init + ID token verification
│       ├── secretManager.js           ← runtime Gemini key fetch, fail-closed
│       ├── gemini.js                  ← chat + structured summary/mood/theme + generic gen
│       ├── validate.js                ← server-side input validation
│       ├── middleware/
│       │   ├── auth.js                ← requireAuth (Firebase ID token)
│       │   ├── rateLimit.js           ← per-uid abuse/cost bound
│       │   └── verifyOidc.js          ← separate trust path for Cloud Scheduler
│       ├── routes/
│       │   ├── journal.js             ← /api/chat, /api/entries
│       │   ├── memory.js              ← /api/memory/context
│       │   ├── dashboard.js           ← /api/dashboard/insights
│       │   └── internal.js            ← /internal/compact/* (OIDC only)
│       ├── memory/
│       │   ├── pipeline.js            ← now/today/recent/archive compaction
│       │   ├── prompts.js             ← compression prompt templates
│       │   └── dashboardPrompts.js    ← mood-linked recommendation prompt
│       └── live/liveRelay.js          ← Gemini Live API WebSocket relay
└── frontend/                          ← React + Vite, Firebase Hosting
    └── src/
        ├── firebase.js / api.js / App.jsx
        ├── lib/localCache.js          ← localStorage cache for snappy reloads
        ├── voice/useVoiceSession.js   ← mic capture + WS + playback
        └── components/
            ├── Login.jsx / EntryList.jsx / EntryDetail.jsx
            ├── EntryComposer.jsx      ← text mode
            ├── VoiceComposer.jsx      ← voice mode (live transcript + ideas)
            ├── ModeToggle.jsx         ← switch text <-> voice mid-session
            ├── MoodTrend.jsx          ← sidebar mood strip
            └── Dashboard.jsx, ClockChart.jsx, HeatmapCalendar.jsx,
                RecommendationCard.jsx ← /dashboard page
```

## Quickstart

See [`DEPLOY.md`](./DEPLOY.md) for the full sequence, including the
Cloud Scheduler + OIDC setup for the memory-compaction jobs. In short:

1. Store your Gemini API key in Secret Manager (never in code).
2. `gcloud run deploy` the `backend/` folder to Cloud Run.
3. Grant the Cloud Run service account `roles/secretmanager.secretAccessor`
   on that one secret only.
4. `firebase deploy --only firestore:rules`.
5. Create the two Cloud Scheduler jobs (daily compaction) with a
   dedicated, narrowly-scoped OIDC service account.
6. Fill in `frontend/.env.example` → `.env.local`, `npm run build`,
   `firebase deploy --only hosting`.

Both `frontend/npm run build` and a `node --check` pass on every backend
file (including the new memory/live modules) have been verified to run
clean in this environment.

## On the "extra tech" list (ADK / RAG / BigQuery / public datasets)

Deliberately not used — see the architecture docs for the reasoning. This
app's data shape (one user's few hundred journal entries) doesn't benefit
from BigQuery-scale analytics or RAG-style retrieval over a large corpus,
and there's no multi-agent workflow that needs ADK orchestration. Cloud
Run, Gemini, and Cloud Scheduler (task automation) are used throughout.

## Security posture at a glance

- Gemini API key: Secret Manager only, fetched server-side, never in the
  client bundle, never committed.
- Auth: Firebase Authentication (text) — every backend route and the voice
  WebSocket both verify a Firebase ID token before doing anything else.
- Isolation: every Firestore read/write (including memory layers) is
  scoped to the **verified** `uid` — never a client-supplied value —
  with Firestore Security Rules as an independent second layer.
- The scheduled memory-compaction jobs run on a completely separate OIDC
  trust path from user requests, scoped to one uid at a time.
- Full threat model: [`ARCHITECTURE.md`](./ARCHITECTURE.md) and
  [`MEMORY_AND_VOICE_ARCHITECTURE.md`](./MEMORY_AND_VOICE_ARCHITECTURE.md).
