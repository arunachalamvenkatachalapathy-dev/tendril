# Voice + Layered Memory Architecture

This extends `ARCHITECTURE.md` with two additions the user asked for:
1. A **voice mode** using the Gemini Live API (native audio in/out), toggleable
   with text mode mid-session, like the Gemini app.
2. A **claude-remember-style layered memory pipeline** (now → today → recent
   → archive) so the companion has real continuity across sessions instead
   of starting blank every time — and so ideas surface back to the user
   immediately, not just get logged.

---

## 1. Layered memory model (the core idea, adapted from claude-remember)

claude-remember's trick is: don't store one giant transcript log. Compress
in layers, each layer cheaper to re-read than the one below it, so a new
session can load "everything that matters" in a handful of short documents
instead of replaying history.

We reproduce the same shape in Firestore instead of local `.md` files:

```
users/{uid}/memory/now              — today's running buffer (uncompressed-ish)
users/{uid}/memory/today-{YYYY-MM-DD} — one doc per day, compressed from that day's entries
users/{uid}/memory/recent           — rolling ~7-day consolidated summary
users/{uid}/memory/archive          — long-term consolidated summary (everything older)
```

```
                 ENTRY SAVED (text or voice)
                          │
                          ▼
        ┌─────────────────────────────────┐
        │  IMMEDIATE (Article 9-safe):     │   <- runs right after every save
        │  extract 1-3 "idea" bullets      │      (your requirement 6a)
        │  append to memory/now            │
        └─────────────────────────────────┘
                          │
              (Cloud Scheduler, daily, per-uid)
                          ▼
        ┌─────────────────────────────────┐
        │  today's memory/now entries      │
        │  → compress → memory/today-{date}│
        │  memory/now cleared for new day  │
        └─────────────────────────────────┘
                          │
              (Cloud Scheduler, daily, per-uid)
                          ▼
        ┌─────────────────────────────────┐
        │  last 7 memory/today-* docs      │
        │  → compress → memory/recent      │
        │  today-* docs older than 7 days  │
        │  → compress → memory/archive     │
        │  (merged with existing archive)  │
        └─────────────────────────────────┘
```

**"Should contain all the nuances" (your requirement 6):** the daily
compaction prompt is explicitly instructed to preserve specific, concrete
detail (names of projects, recurring people, specific worries or plans) —
not to produce a generic one-line mood label. See
`backend/src/memory/prompts.js`. The `recent` and `archive` layers are
allowed to run longer (a few paragraphs) precisely so nuance survives
compression — we're optimizing for "small enough to inject into every
session," not "as short as possible."

### Why compaction happens server-side, not per-request

If we recomputed `recent`/`archive` on every chat message, that's an extra
Gemini call (cost + latency) on every single turn, and it reprocesses the
same week of entries dozens of times a day. Instead: compact once daily
(and immediately for the fast "now" idea-extraction layer, since that's
cheap — one entry, not a week of them), store the result, and every
conversation just *reads* the pre-compressed `recent` + `archive` docs to
build its system prompt. This is the same trade-off claude-remember makes
with its hourly/daily compression cadence.

## 2. Injecting memory into a new conversation ("show ideas immediately")

When the user opens a new session (voice or text), the backend:
1. Loads `memory/now` (today so far), `memory/recent` (last ~7 days), and
   `memory/archive` (older) for `req.uid` — three small Firestore reads.
2. Builds a system-instruction preamble like:
   > "Context from the user's own past journal entries (for continuity —
   > don't quote it back verbatim unless relevant): RECENT: ... ARCHIVE: ..."
3. Passes that as the `systemInstruction` for both the text chat model and
   the Gemini Live session's setup message.
4. Separately, `memory/now`'s idea bullets (from requirement 6a) are sent
   straight to the frontend as a list on session start, so the UI can show
   "Ideas from today" immediately, before the user says anything.

This means: open a new session, and the companion already knows what you
were wrestling with recently and can surface an idea back to you — the
behavior you asked for.

## 3. Voice mode architecture (Gemini Live API)

```
┌────────────┐   mic audio (PCM16 chunks)   ┌──────────────────────┐   Live API session   ┌──────────────┐
│  Browser    │ ───────────────────────────▶ │  Cloud Run WS relay   │ ─────────────────────▶│ Gemini Live   │
│  (getUserMedia,                            │  /ws/voice            │                        │ (native audio) │
│  AudioWorklet,                             │  - verifies Firebase  │◀───────────────────── │                │
│  WebSocket client)                         │    ID token first     │  audio + text + ideas  └──────────────┘
│                                            │  - holds Gemini key    │
│  plays back audio,                        │    (Secret Manager)    │
│  renders live transcript  ◀─────────────── │  - injects memory      │
│  + streamed idea bullets                   │    context at session  │
└────────────┘                              │    start                │
                                             └──────────────────────┘
```

Key points, mapped to your answers:
- **1a/1c** — mode toggle: the frontend has a single `ModeToggle` that
  switches the composer between `VoiceComposer` and the existing
  `EntryComposer` (text). Both write to the same in-memory "current
  session messages" state, so switching mid-conversation doesn't lose
  context — the transcript so far is replayed as the Live session's
  starting history when you switch into voice, and vice versa.
- **2c** — Gemini Live API (native audio) is used for understanding *and*
  replying in voice — one model, not a separate STT+TTS pipeline.
- **3a** — live transcript renders as audio streams in; idea bullets
  stream into a sidebar via a separate message type on the same socket,
  computed by prompting the Live session (or a lightweight parallel text
  call) to periodically emit short idea fragments as the conversation
  develops.
- **7b** — continuous listening while the voice session is open (no
  push-to-talk button) — the mic stays hot until the user ends the
  session or switches to text.
- **8b** — language: Live API auto-detects/handles multiple languages;
  we default the session to English and only pass a different language
  hint if the user has set one in Settings.
- **9/composer parity** — transcript is always shown as text underneath
  the voice UI (per your requirement 3a/9), so nothing is voice-only.

### A note on the Live API surface

The Gemini Live API is a fast-moving, real-time surface (WebSocket-based
bidirectional streaming, specific audio formats — 16kHz PCM16 input /
24kHz PCM16 output — and a session `setup` message that configures the
model, response modality, and system instruction). The relay code in
`backend/src/live/liveRelay.js` implements this against the shape of the
API as documented as of this build, but **you should double-check the
exact message schema and model name (currently `gemini-3.1-flash-live-preview`,
successor to `gemini-2.5-flash-native-audio-preview-12-2025` — the older
`gemini-2.0-flash-live-001` is retired) against
Google AI Studio's own "Stream" tab and the current Live API docs before
your demo** — this is the one part of the stack most likely to have moved
since. The security boundary (Articles 2, 3, 8) is stable regardless of
which exact model string you use.

## 4. Local browser cache (your requirement 5b)

`frontend/src/lib/localCache.js` caches the `recent` + `archive` memory
text and the day's idea bullets in `localStorage`, keyed by uid, with a
short TTL. On app load, the UI renders instantly from cache while a fresh
fetch happens in the background and replaces it — avoids a blank/loading
flash on every reload without adding IndexedDB complexity for what is a
small amount of text.

## 5. Cloud Scheduler wiring (requirement 6c)

Two scheduled HTTP jobs hit an internal, non-public endpoint on the
backend:

```
0 1 * * *   → POST /internal/compact/daily     (now -> today-{date}, per active uid)
0 2 * * *   → POST /internal/compact/rollup    (today-* -> recent, older -> archive)
```

Both endpoints are protected by OIDC-token verification (Article 9): only
requests bearing a valid Google-signed identity token for the specific
Cloud Scheduler service account are accepted — a Firebase user token does
NOT work here, and vice versa. See `DEPLOY.md` (updated) for the exact
`gcloud scheduler jobs create` commands and IAM bindings.
