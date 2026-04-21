# MedEdBot — Vercel edition

A Next.js rewrite of the original FastAPI LINE bot, designed for Vercel's serverless runtime.

## Architecture

| Concern | Implementation |
|---|---|
| Web framework | Next.js 15 (App Router, Node runtime) |
| AI | `@google/genai` against **Vertex AI** (service-account auth) — Gemini 2.5 Flash for text, `gemini-2.5-flash-preview-tts` for TTS, Gemini 2.5 Flash for STT |
| Taiwanese TTS | NYCU iVoice (`tts001.ivoice.tw`) — same external service as the Render build |
| Session state | Upstash Redis (24h TTL) |
| Audio + email archive storage | Vercel Blob (public URLs) |
| Database | Neon Postgres via `@neondatabase/serverless` + Drizzle |
| Email | Gmail SMTP via Nodemailer |
| Periodic cleanup | Vercel Cron (`0 * * * *`) |

## Environment variables

Copy `.env.example` to `.env.local` (for dev) and set the same variables in the Vercel dashboard (Production + Preview):

```
GOOGLE_CREDS_B64=       # base64 of service-account JSON (see below)
VERTEX_PROJECT_ID=      # optional override; defaults to project_id in the JSON
VERTEX_LOCATION=us-central1
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
DATABASE_URL=postgres://...sslmode=require
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
BLOB_READ_WRITE_TOKEN=
GMAIL_ADDRESS=
GMAIL_APP_PASSWORD=
CRON_SECRET=            # optional: extra auth for /api/cron/cleanup
```

### Vertex AI auth setup

1. In Google Cloud Console, enable **Vertex AI API** on your project.
2. Create a **service account** with role `roles/aiplatform.user` (and `roles/ml.developer` if you want preview features). Create a JSON key for it.
3. Base64-encode the whole key file and set it as `GOOGLE_CREDS_B64`:
   ```bash
   base64 -i ~/Downloads/my-key.json | tr -d '\n' | pbcopy
   ```
4. Leave `VERTEX_LOCATION=us-central1` — preview TTS needs it.

## Provisioning

1. **Create the Vercel project** — link this repo, pick the default Next.js build settings.
2. **Add Marketplace integrations**:
   - Upstash Redis (free tier) → auto-sets `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
   - Neon Postgres → auto-sets `DATABASE_URL`.
3. **Enable Vercel Blob** in Storage → sets `BLOB_READ_WRITE_TOKEN`.
4. **Set remaining secrets** (`GEMINI_API_KEY`, LINE tokens, Gmail creds).
5. **Push the DB schema**:
   ```bash
   npx drizzle-kit push
   ```
6. **Set the LINE webhook URL** to `https://<your-domain>/api/webhook`.

## Routes

- `POST /api/webhook` — LINE Messaging API webhook (`maxDuration: 300`).
- `GET  /api/health` — health check (returns JSON).
- `GET  /api/ping` — liveness probe.
- `GET  /api/cron/cleanup` — triggered by Vercel Cron hourly. Mostly a no-op since Redis auto-expires sessions and Blob retention is managed by Vercel.

## Dev

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

For webhook testing locally, forward the dev server with a tunnel (ngrok/Cloudflare Tunnel) and point LINE's webhook at the public URL.

## Deploy

```bash
vercel deploy                # preview
vercel deploy --prod         # production
```

The project requires Fluid Compute (default on Pro). Free/Hobby accounts cap webhook duration at 60s — which is usually enough for a single Gemini call but can timeout on heavy modify+search flows.

## Feature parity with the Render version

- [x] Education mode (zh generation, modify, translate, email)
- [x] Medical chat mode (plainify → translate)
- [x] Taiwanese translation (TLPA) + TTS via NYCU iVoice
- [x] Gemini STT for audio messages (chat mode only)
- [x] Reference extraction from Gemini grounding metadata
- [x] LINE message bubble limits (5 bubbles / 5000 chars / 2000 per bubble)
- [x] Quick-reply templates for every mode/state
- [x] Taigi credit bubble
- [x] MX record validation before sending email
- [x] Blob archive of emailed content (logged to `gemini_output_url`)
- [x] DB logging: chat, tts, voicemail

## Notes on the port

- Sessions are whole-object `GET`/`SET`ed from Redis with a 24h TTL — no per-field hash, because a single LINE webhook is one read + one write.
- Audio is uploaded to Vercel Blob with `access: "public"` and `addRandomSuffix: true`; the returned URL goes straight into the `AudioSendMessage.originalContentUrl`.
- The asyncio cleanup loop from the Python version is gone; Redis TTL handles session expiry and the cron endpoint is a placeholder for future sweeps.
- `threading.RLock`, `ThreadPoolExecutor`, the in-process rate limiter, and the circuit breaker were all process-local constructs that don't translate to serverless — they've been removed. If you need cross-invocation rate limiting, wire up `@upstash/ratelimit` against the same Redis instance.
