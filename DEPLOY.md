# Deploy guide — Personal Gemini Journal

Assumes you already have a Firebase project with a linked GCP project and
billing enabled (needed for Cloud Run + Secret Manager). Replace
`YOUR_PROJECT_ID` throughout.

## 0. One-time setup

```bash
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  generativelanguage.googleapis.com
```

In the Firebase Console:
1. **Authentication** → Sign-in method → enable **Google**.
2. **Firestore Database** → create database in **Native mode**, same region
   you'll deploy Cloud Run to (e.g. `asia-south1` for lower latency from
   India).

## 1. Store the Gemini API key in Secret Manager (never in code)

Get a Gemini API key from Google AI Studio, then:

```bash
echo -n "PASTE_YOUR_GEMINI_API_KEY_HERE" | \
  gcloud secrets create GEMINI_API_KEY \
    --data-file=- \
    --replication-policy="automatic"
```

If the secret already exists and you're rotating it:

```bash
echo -n "NEW_KEY_VALUE" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
```

## 2. Deploy the backend to Cloud Run

```bash
cd backend

gcloud run deploy personal-gemini-journal-api \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID=YOUR_PROJECT_ID,GEMINI_SECRET_NAME=GEMINI_API_KEY,ALLOWED_ORIGINS=https://YOUR_PROJECT_ID.web.app
```

`--allow-unauthenticated` is at the Cloud Run networking layer only — every
route under `/api` still enforces Firebase ID token verification inside the
app (Article 2). Cloud Run's own IAM-based auth is a valid alternative if
you prefer defense-in-depth at the infra layer too, but requires the
frontend to mint Google-signed tokens rather than Firebase ID tokens, which
adds complexity out of scope for this challenge.

**Grant the Cloud Run service account access to the secret — and only that
secret:**

```bash
# Find the service account Cloud Run is using (default compute SA unless
# you configured a custom one):
SERVICE_ACCOUNT=$(gcloud run services describe personal-gemini-journal-api \
  --region asia-south1 --format='value(spec.template.spec.serviceAccountName)')

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

Do **not** grant `roles/editor` or project-wide Secret Manager access — this
binding scopes access to the one secret only (Article 3).

Note the deployed URL, e.g. `https://personal-gemini-journal-api-xxxx.a.run.app`.

## 3. Deploy Firestore security rules

```bash
cd ..  # repo root, where firestore.rules and firebase.json live
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

## 4. Configure and deploy the frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in the Firebase web config values from:
# Firebase Console → Project settings → Your apps → Web app
# Set VITE_API_BASE_URL to the Cloud Run URL from step 2.

npm install
npm run build

cd ..
firebase deploy --only hosting --project YOUR_PROJECT_ID
```

## 5. Verify isolation (do this before calling it done)

1. Sign in as User A in a normal browser window, save a couple of entries.
2. Sign in as User B in an incognito window, confirm the entry list is
   empty and `GET /api/entries` for B never returns A's data.
3. In the Firebase Console → Firestore, confirm entries live under
   `users/{A's uid}/entries/...` and `users/{B's uid}/entries/...`
   separately.
4. Try the Firestore Rules simulator (Console → Firestore → Rules →
   Simulator) with a read on `users/{A's uid}/entries/{someId}` as an
   authenticated user with a *different* uid — confirm it's denied.
5. Confirm the Gemini API key never appears in the frontend's built JS:
   `grep -r "AIza" frontend/dist/` should return nothing (Gemini keys
   commonly start with `AIza`).

## 6. Cloud Scheduler — daily memory compaction (Article 9)

Create a dedicated, narrowly-scoped service account for Scheduler to invoke
the internal endpoints with — never reuse the Cloud Run runtime SA for this:

```bash
gcloud iam service-accounts create scheduler-invoker \
  --display-name="Cloud Scheduler -> Personal Gemini Journal compaction"

# Let it invoke the Cloud Run service (Cloud Run's own IAM layer)
gcloud run services add-iam-policy-binding personal-gemini-journal-api \
  --region asia-south1 \
  --member="serviceAccount:scheduler-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

Enable Cloud Scheduler and create the two jobs (adjust the URL to your
actual Cloud Run URL from step 2):

```bash
gcloud services enable cloudscheduler.googleapis.com

gcloud scheduler jobs create http compact-now-to-today \
  --schedule="0 1 * * *" \
  --uri="https://YOUR_CLOUD_RUN_URL/internal/compact/daily" \
  --http-method=POST \
  --oidc-service-account-email="scheduler-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --oidc-token-audience="https://YOUR_CLOUD_RUN_URL" \
  --location=asia-south1

gcloud scheduler jobs create http compact-recent-and-archive \
  --schedule="0 2 * * *" \
  --uri="https://YOUR_CLOUD_RUN_URL/internal/compact/rollup" \
  --http-method=POST \
  --oidc-service-account-email="scheduler-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --oidc-token-audience="https://YOUR_CLOUD_RUN_URL" \
  --location=asia-south1
```

Set `SCHEDULER_AUDIENCE` and `SCHEDULER_SERVICE_ACCOUNT` on the Cloud Run
service to match (redeploy or `gcloud run services update --set-env-vars`).

**Verify isolation of this path too:** try calling
`https://YOUR_CLOUD_RUN_URL/internal/compact/daily` with a normal Firebase
user ID token instead of an OIDC token — it must be rejected with 401/403.

## 7. Voice — Firestore collection-group indexes

The memory pipeline's scheduled jobs use `collectionGroup('memory')`
queries (see `backend/src/memory/pipeline.js`). On first run, Firestore
will likely reject these with an error containing a console link to
auto-create the required index — click it, or create manually:

```bash
gcloud firestore indexes composite create \
  --collection-group=memory \
  --field-config field-path=dateLabel,order=ascending \
  --field-config field-path=__name__,order=ascending

gcloud firestore indexes composite create \
  --collection-group=memory \
  --field-config field-path=date,order=ascending \
  --field-config field-path=__name__,order=ascending
```

## 8. Local development

```bash
# Backend
cd backend
cp .env.example .env
gcloud auth application-default login   # lets ADC work locally without a key file
npm install
npm run dev   # listens on :8080

# Frontend, in another terminal
cd frontend
cp .env.example .env.local
# point VITE_API_BASE_URL at http://localhost:8080
npm install
npm run dev   # listens on :5173
```
