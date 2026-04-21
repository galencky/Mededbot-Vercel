# Old (Python/Render) → New (Next.js/Vercel/Vertex AI)

Side-by-side of what changed, what stayed, and where behavior differs.

## TL;DR

- **Feature parity kept for every user-facing behavior.** Education mode, medical chat mode, voicemail, Taigi, TTS, translation, email, quick replies — all present.
- **The infrastructure underneath is completely different.** Long-lived FastAPI process → stateless serverless functions. In-memory state → Redis + Blob + Postgres.
- **Gemini auth moved from API key → Vertex AI service account.** Same SDK (`@google/genai`), different backend.
- **Two safety nets were removed without replacement**: the in-process rate limiter and circuit breaker. These were process-local Python primitives that don't work across ephemeral serverless invocations. Re-add later with `@upstash/ratelimit` if needed.
- **Model IDs unchanged** — `gemini-2.5-flash` and `gemini-2.5-flash-preview-tts`. The preview TTS model's availability on Vertex AI in your region should be verified on first deploy.

---

## Feature parity

| Feature | Old (Python/FastAPI) | New (Next.js/Vercel) | Status |
|---|---|---|---|
| **LINE webhook** | `/webhook`, FastAPI + `line-bot-sdk` Python | `app/api/webhook/route.ts`, `@line/bot-sdk` Node | ✅ Same |
| Signature verification | HMAC-SHA256 via `WebhookHandler.handle` | `validateSignature` from `@line/bot-sdk` | ✅ Same |
| Always returns "OK" to prevent retries | ✅ | ✅ `NextResponse.json({ ok: true })` | ✅ Same |
| **Education mode: generate** | `call_zh()` + `gemini-2.5-flash` + Google Search grounding | `callZh()` in `lib/gemini/text.ts` | ✅ Same |
| Education mode: modify | `call_zh()` with `modify_prompt` | `callModify()` in `lib/gemini/text.ts` | ✅ Same |
| Education mode: translate | `call_translate()` | `callTranslate()` — blocks Taigi identically | ✅ Same |
| Education mode: email | `send_last_txt_email()` + MX check + R2 upload | `sendEducationEmail()` + `hasMxRecord()` + Blob upload | ✅ Same, R2→Blob |
| **Medical chat mode: plainify → translate** | `plainify()` + `confirm_translate()` | Same names in `lib/gemini/text.ts` | ✅ Same |
| Chat mode: Taigi branch | `translate_to_taigi()` (skip Gemini) | Same | ✅ Same |
| Chat mode: `繼續翻譯` command | Clears TTS + translations, re-prompts | Same | ✅ Same |
| **Voicemail (audio messages)** | STT via Gemini inline-audio, then medchat flow | Same, `lib/gemini/stt.ts` + `handleAudioMessage` | ✅ Same |
| Audio rejected in wrong mode | ✅ with context-specific quick-replies | ✅ `audioRejection()` mirrors all four states | ✅ Same |
| **TTS: Gemini** | `gemini-2.5-flash-preview-tts`, voice "Kore", 24kHz PCM → WAV | Same model, same voice, `pcmToWav()` wraps PCM | ✅ Same |
| TTS: Taigi via NYCU iVoice | GET `/html_taigi_zh_tw_py` + `/synthesize_TLPA` | Same endpoints via `fetch()` | ✅ Same |
| Taigi credit bubble | FlexMessage shown above audio | `taigiCreditFlex()` | ✅ Same |
| **References from Gemini grounding** | BeautifulSoup parsing of `rendered_content` | Regex on `renderedContent` (same HTML) | ✅ Same |
| References → Flex bubble | ✅ | `referencesFlex()` | ✅ Same |
| References dedup by URL | ✅ (on modify/translate) | `mergeReferences()` | ✅ Same |
| **LINE message limits** | 5 bubbles, 5000 chars total, 2000/bubble | Same constants in `lib/line/limits.ts` | ✅ Same |
| Splitter with natural break points | Paragraph > sentence > line > comma > space | `splitLongText()` uses same priority | ✅ Same |
| Truncation notice | "⚠️ 內容因超過 LINE 限制已截斷..." | Same string | ✅ Same |
| **Quick reply templates** | MODE_SELECTION, COMMON/EDU_LANGUAGES, COMMON_DISEASES, EDU_ACTIONS, CHAT_TTS_OPTIONS, etc. | All present in `lib/constants/quick-reply.ts` | ✅ Same (exact labels/texts) |
| **Session TTL** | 24h in-memory dict + hourly cleanup task | 24h via Redis `ex: 86400` — no sweep needed | ✅ Same TTL, better mechanism |
| Session keys | ~20 boolean/string fields | Same field names in `Session` type | ✅ Same schema |
| **Email disclaimer** | Prepended legal disclaimer | `DISCLAIMER` constant in `lib/email/service.ts` | ✅ Same |
| MX record validation | `dns.resolver.resolve(domain, "MX", lifetime=3)` | `dns.promises.resolveMx()` with 3s timeout | ✅ Same |
| **DB logging: chat_logs** | ChatLog table via SQLAlchemy | `chat_logs` via Drizzle, same columns | ✅ Same |
| DB logging: tts_logs | TTSLog table | `tts_logs` | ✅ Same |
| DB logging: voicemail_logs | VoicemailLog table | `voicemail_logs` | ✅ Same |
| **Validators** | sanitize_user_id, sanitize_filename, validate_email, sanitize_text | Ported verbatim in `lib/validators.ts` | ✅ Same |
| Path traversal guard | `create_safe_path()` | Filename-only handling on Blob (no fs paths) | ✅ Safer |
| **Health check** | `/health`, `/ping` | `/api/health`, `/api/ping` | ✅ Same |

---

## Infrastructure: what changed and why

| Concern | Old | New | Reason |
|---|---|---|---|
| **Runtime** | Long-lived FastAPI + Uvicorn | Next.js serverless functions | Vercel model |
| **Process** | Single Docker container | Cold-startable function per request | Serverless |
| **AI auth** | `GEMINI_API_KEY` (API key) | Vertex AI + service-account JSON (`GOOGLE_CREDS_B64`) | User preference; better IAM story |
| **AI SDK** | `google-genai` Python | `@google/genai` Node — same SDK, different language | Required for TS |
| **Session state** | `Dict[str, Dict]` in process memory + `threading.RLock` | Upstash Redis, 24h TTL, get/set per request | State can't live in a serverless process |
| **Audio storage** | Three modes: LOCAL disk / MEMORY dict / Cloudflare R2 | **One mode**: Vercel Blob (public URL) | Serverless has no persistent disk |
| **Email archive storage** | Cloudflare R2 at `https://galenchen.uk/...` | Vercel Blob (public URL) | Consolidate |
| **Database** | Neon Postgres via SQLAlchemy + asyncpg + pool (5+10) | Neon Postgres via `@neondatabase/serverless` (HTTP driver) + Drizzle | Serverless-native; no pool = no connection starvation |
| **Email** | `smtplib` SSL port 465 | `nodemailer` SSL port 465 | Equivalent |
| **Periodic cleanup** | `asyncio` task, every 1h, in `lifespan` | Vercel Cron hitting `/api/cron/cleanup` | asyncio tasks don't survive serverless lifecycles |
| **Logging** | Python thread pool (5 workers) for fire-and-forget | `void logChat()` — JS promises handle it | No thread pool needed in Node |
| **Rate limiter** | `RateLimiter` with `defaultdict(deque)`, per-user keys | ❌ **Removed** | Process-local state doesn't work in serverless. Add `@upstash/ratelimit` if needed |
| **Circuit breaker** | Custom CLOSED/OPEN/HALF_OPEN state for Gemini | ❌ **Removed** | Same reason |
| **Deployment** | Render (`render.yaml`), Docker, Synology variant | Vercel (`vercel.json`, Fluid Compute) | User preference |

---

## Behavior changes worth knowing

### Breaking / observable differences

1. **Rate limiting is gone.** The old bot enforced 30 Gemini calls/min globally, 20 TTS/min per user, 30 Taigi/min. On Vercel there's no shared memory, so those local counters meant nothing anyway across replicas — but on a single Render instance they did limit things. If you want it back, use Upstash's Ratelimit library against the same Redis instance that already holds sessions. The Gemini/Vertex side has its own quota enforced at the cloud level, so you're protected there by default.

2. **Circuit breaker is gone.** Same reason. On failure you'll just see upstream errors bubble up until Gemini recovers. For a chat bot this is acceptable — the old breaker mostly just returned a fallback string after 5 failures.

3. **Webhook timeout model is different.** Old FastAPI used a 48-second `asyncio.wait_for` wrapper. New code inherits Vercel's function timeout (`maxDuration: 300` in `vercel.json` for the webhook route). This requires **Fluid Compute / Pro plan** to actually get 300s; on Hobby you're capped at 60s.

4. **Audio URLs live on Vercel Blob, not `galenchen.uk`.** The custom R2 domain is no longer used. Audio URLs returned to LINE look like `https://<random>.public.blob.vercel-storage.com/tts_audio/<filename>-<random>.wav`. LINE accepts any HTTPS URL, so this is fine — but you lose the custom domain.

5. **Session state has no process-local lock.** The old code had per-user `RLock` to avoid concurrent webhook writes corrupting state. The new code does `getSession` → mutate → `saveSession`. If LINE delivers two webhooks for the same user in rapid succession, the second one's save could clobber the first. In practice LINE single-files by user, so this is unlikely to bite — but it's a real difference.

6. **Three storage modes collapsed to one.** The old `utils/storage_config.py` auto-detected LOCAL / MEMORY / R2. The new code always uses Vercel Blob. Simpler.

### Non-breaking but different

1. **Redis TTL replaces hourly cleanup.** Sessions auto-expire 24h after last write — no sweep needed. The `/api/cron/cleanup` endpoint is a no-op placeholder you could repurpose.

2. **DB connection pool is gone.** Neon's HTTP driver makes each query a standalone HTTPS call. This adds ~20ms per query but eliminates pool-exhaustion class of bugs on serverless.

3. **Stickers and images fall through silently.** The old code had `fallback_handler` registered for `StickerMessage` / `ImageMessage` that just logged the type. The new code does nothing for non-text/non-audio messages. No user-facing change.

4. **`prev_mode` preservation, `awaiting_stt_translation`, `tts_queue`** — these appear in the old docs but weren't actually used in the Python handlers I ported from. No regression; both systems lack them.

### Safer

1. **No secrets in API keys.** `GOOGLE_CREDS_B64` goes through Vertex AI's IAM — revoke the service-account key if it leaks.
2. **No writable filesystem.** The old bot could theoretically write anywhere `appuser` had permissions. Serverless can only touch `/tmp`, and the new code doesn't touch even that.
3. **Input validators tightened**: `sanitizeFilename` now normalizes Unicode (NFKD) and rejects traversal attempts before they reach any storage layer.

---

## Things removed (intentional)

- `Dockerfile`, `Dockerfile.synology`, `docker-compose*.yml`, `render.yaml`, `requirements.txt`, `runtime.txt` — not needed on Vercel.
- `utils/circuit_breaker.py`, `utils/rate_limiter.py` — process-local, can't survive serverless.
- `utils/cleanup.py`, `utils/memory_storage.py`, `utils/paths.py`, `utils/storage_config.py` — replaced by Vercel Blob.
- `utils/r2_service.py` — replaced by `@vercel/blob`.
- `utils/retry_utils.py` — `@google/genai` does its own retry internally; kept simple.
- `utils/logger_config.py`, `utils/uvicorn_logging.py` — Vercel's log pipeline just captures stdout.
- `scripts/` and `outdated/` — stale.
- `documents/ARCHITECTURE_ANALYSIS.md`, `COMPREHENSIVE_FUNCTION_REFERENCE.md`, `DEPLOYMENT.md`, `README.md`, `RENDER_DEPLOYMENT.md` — all described the Python bot. `documents/QRcode_poster.pdf` is kept.

---

## Things added

- `scripts/smoke.ts` — 20 pure-logic unit tests (validators, splitter, WAV header, language normalizer, quick-reply builder, LINE limits, HMAC). Run with `npx tsx scripts/smoke.ts`.
- `vercel.json` — function `maxDuration` and cron schedule.
- `drizzle.config.ts` + `lib/db/schema.ts` — typed DB schema, `npx drizzle-kit push` to create tables.
- Typed `Session` in `lib/session/types.ts` — replaces the untyped Python dict.
- `COMPARISON.md` (this file).

---

## Known risks for first deploy

1. **`gemini-2.5-flash-preview-tts` availability on Vertex AI.** The research agent noted they weren't 100% sure this exact preview ID is GA on Vertex in all regions. If first TTS call errors with a model-not-found, check `VERTEX_LOCATION` (keep it `us-central1`) or try `ai.models.list()` against your project.

2. **NYCU iVoice is HTTP, not HTTPS.** `http://tts001.ivoice.tw:8804` is plaintext. Vercel Functions can reach it, but if the upstream adds TLS or blocks server-origin fetches, Taigi TTS breaks. Same risk as before — not new.

3. **Long Gemini+TTS chains.** A full edu flow: `call_zh` → parse refs → respond. That fits in 60s easily. A modify-with-search → new refs → respond might push 45–60s. On Hobby you'll timeout; on Pro with Fluid Compute you have 300s headroom.

4. **Blob public URLs are visible.** Old R2 URLs on `galenchen.uk` were also public, so no net change — but if you want private audio, Vercel Blob supports it and you'd need to mint signed URLs in the webhook response. Not currently wired up.

5. **First DB writes.** If `DATABASE_URL` points at a fresh Neon branch, run `npx drizzle-kit push` once before deploy or the insert queries will fail.
