# Deployment Guide — Zero to Production

A follow-along checklist. You'll provision seven services and wire them into a Vercel project. Budget ~45 minutes the first time.

**Assumption**: you have a computer with `node >= 20`, `npm`, `git`, and the repo cloned. If you hit an unfamiliar term, run `npm install` in the repo first — many local commands need `node_modules`.

---

## 0. Accounts you'll need

Sign up for each (free tier is fine for all except possibly Vercel):

- [ ] **Vercel** — <https://vercel.com> (Pro plan recommended for `maxDuration: 300`; Hobby works with 60s cap)
- [ ] **Google Cloud** — <https://console.cloud.google.com>
- [ ] **Neon** — <https://neon.tech> (or add via Vercel Marketplace)
- [ ] **Upstash** — <https://upstash.com> (or add via Vercel Marketplace)
- [ ] **LINE Developers** — <https://developers.line.biz>
- [ ] A Gmail account with 2FA enabled (for SMTP)
- [ ] **GitHub** — the repo is already at `github.com/galencky/Mededbot-Vercel`

Keep a scratch file open. You'll collect ~12 secrets along the way.

---

## 1. Google Cloud — enable Vertex AI and create a service account

### 1a. Create / select a project

1. Go to <https://console.cloud.google.com>.
2. Top bar → project dropdown → **New Project**. Name it `mededbot-vertex` (or whatever). Wait ~30s for creation.
3. Copy the **Project ID** (not the name — the ID, e.g. `mededbot-vertex-123456`). Save as `VERTEX_PROJECT_ID`.

### 1b. Enable APIs

1. Left nav → **APIs & Services** → **Library**.
2. Search `Vertex AI API` → click → **Enable**. Wait ~30s.
3. (Optional but recommended) also enable `Cloud Resource Manager API`.

### 1c. Create a service account

1. Left nav → **IAM & Admin** → **Service Accounts** → **Create Service Account**.
2. Name: `mededbot-runtime`. Click **Create and Continue**.
3. Role: **Vertex AI User** (`roles/aiplatform.user`). Click **Continue** → **Done**.
4. You'll land on the service accounts list. Click the one you just made.
5. Tab: **Keys** → **Add Key** → **Create new key** → JSON. A file downloads, e.g. `mededbot-vertex-abc123.json`.

### 1d. Base64-encode the key

On macOS/Linux:
```bash
base64 -i ~/Downloads/mededbot-vertex-*.json | tr -d '\n' | pbcopy
```

On Linux without `pbcopy`:
```bash
base64 -w 0 ~/Downloads/mededbot-vertex-*.json > /tmp/creds.b64 && cat /tmp/creds.b64
```

Save the clipboard as `GOOGLE_CREDS_B64`. Treat it like a password — it grants API access.

**Delete the `.json` file from your Downloads** once it's copied. You don't need it again (you can always create a new key from the console).

---

## 2. Neon Postgres — create a database

Two paths. Pick one.

### 2a. Via Vercel Marketplace (easiest)

Skip to step 7 — you'll add Neon as a Storage integration during Vercel setup, and `DATABASE_URL` will be injected automatically.

### 2b. Standalone Neon account

1. <https://console.neon.tech> → sign in → **Create Project**.
2. Name: `mededbot`. Region: pick one near your Vercel region (usually `us-east-1` or `ap-southeast-1`). Postgres 16 is fine.
3. After creation, the dashboard shows a connection string. Click the `Connection Details` panel and copy the **pooled** connection string (it contains `-pooler` in the hostname).
4. Save as `DATABASE_URL`. It should look like:
   ```
   postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```

---

## 3. Upstash Redis — create a session store

### 3a. Via Vercel Marketplace

Skip to step 7. Upstash provisions automatically and injects `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

### 3b. Standalone Upstash account

1. <https://console.upstash.com> → **Create Database** → Redis.
2. Name: `mededbot-sessions`. Type: **Regional** (not Global — sessions don't need multi-region). Region: near your Vercel region.
3. After creation, go to the **REST API** tab.
4. Copy **UPSTASH_REDIS_REST_URL** (looks like `https://xxx.upstash.io`) and **UPSTASH_REDIS_REST_TOKEN`.

---

## 4. Vercel Blob — create a store

This can only be done after the Vercel project exists, so skip for now. Comes back in step 8.

---

## 5. Gmail — generate an app password

1. Go to <https://myaccount.google.com/security>.
2. Confirm **2-Step Verification** is on. If not, enable it first (required for app passwords).
3. Search the settings page for "App passwords" (or go to <https://myaccount.google.com/apppasswords>).
4. Generate a new password. Name it `mededbot`. Google shows a 16-character string once — copy it immediately.
5. Save as `GMAIL_APP_PASSWORD`. Save your email address as `GMAIL_ADDRESS`.

If you don't see the App Passwords page, your Google Workspace admin may have disabled it. Use a personal Gmail account instead.

---

## 6. LINE — create a Messaging API channel

1. <https://developers.line.biz/console/> → **Providers** → create or pick one.
2. Inside the provider → **Create a new channel** → **Messaging API**.
3. Fill in channel name, description, category (Healthcare/Medical works), region.
4. After creation, go to the **Basic settings** tab.
   - Scroll to **Channel secret** → copy. Save as `LINE_CHANNEL_SECRET`.
5. Go to the **Messaging API** tab.
   - Scroll to **Channel access token** → **Issue** → copy. Save as `LINE_CHANNEL_ACCESS_TOKEN`.
6. On the same tab:
   - **Auto-reply messages** → **Disabled** (so the bot owns replies).
   - **Greeting message** → your call. Disable if you want full control.
   - **Webhook** — we'll fill in the URL in step 10.
7. Add your own LINE account as a friend of the bot: scan the QR code on this page.

---

## 7. Vercel — create the project

1. <https://vercel.com/dashboard> → **Add New...** → **Project**.
2. **Import Git Repository** → authorize GitHub if needed → pick `Mededbot-Vercel`.
3. Framework preset: **Next.js** (auto-detected).
4. Root directory: `./` (leave default).
5. **Don't click Deploy yet.** Expand **Environment Variables** and skip to step 9 below — you'll need all envs set before the first deploy, otherwise the build succeeds but the functions throw at runtime.

(If you accidentally hit Deploy: no problem. Add envs later and redeploy.)

---

## 8. Vercel Blob — create the store

1. In your new Vercel project → **Storage** tab → **Create Database** → **Blob**.
2. Name: `mededbot-media`. Region: same as your project.
3. Click **Create**. Vercel automatically adds `BLOB_READ_WRITE_TOKEN` to your project's environment variables.

(If you also added Neon/Upstash via Marketplace in steps 2a/3a, do them here the same way.)

---

## 9. Environment variables — fill them in

In your Vercel project → **Settings** → **Environment Variables**. Add each of the following for **Production, Preview, and Development**:

| Name | Value | From |
|---|---|---|
| `GOOGLE_CREDS_B64` | (long base64 string) | Step 1d |
| `VERTEX_PROJECT_ID` | `mededbot-vertex-123456` | Step 1a (optional, defaults to `project_id` in the JSON) |
| `VERTEX_LOCATION` | `us-central1` | Literal — required for preview TTS |
| `LINE_CHANNEL_SECRET` | (32-char string) | Step 6 |
| `LINE_CHANNEL_ACCESS_TOKEN` | (long string) | Step 6 |
| `DATABASE_URL` | `postgresql://...?sslmode=require` | Step 2 (or auto-injected) |
| `UPSTASH_REDIS_REST_URL` | `https://xxx.upstash.io` | Step 3 (or auto-injected) |
| `UPSTASH_REDIS_REST_TOKEN` | (long string) | Step 3 (or auto-injected) |
| `BLOB_READ_WRITE_TOKEN` | (starts with `vercel_blob_rw_...`) | Step 8 (auto-injected) |
| `GMAIL_ADDRESS` | `you@gmail.com` | Step 5 |
| `GMAIL_APP_PASSWORD` | (16-char, with or without spaces — Vercel preserves either) | Step 5 |
| `CRON_SECRET` | any random string, e.g. `openssl rand -hex 32` | Protects `/api/cron/cleanup` |

Double-check: **no leading/trailing spaces**, and `GOOGLE_CREDS_B64` should be **one single line** (no newlines).

---

## 10. Push the database schema

Drizzle creates the three tables (`chat_logs`, `tts_logs`, `voicemail_logs`) from `lib/db/schema.ts`. Run this **once** from your local machine:

```bash
# From the repo root
echo "DATABASE_URL=postgresql://...your-connection-string..." > .env.local
npx drizzle-kit push
```

It should print something like `Changes applied` and show the three `CREATE TABLE` statements. If it hangs or errors, your `DATABASE_URL` is wrong or the Neon branch is paused (free-tier Neon auto-pauses; poke the Neon dashboard to wake it).

You can delete `.env.local` afterward or keep it for local dev.

---

## 11. Deploy

Back in Vercel → your project → **Deployments** tab → **Redeploy** (or push any commit to `main` and it auto-deploys).

Watch the build logs. It should finish in ~60 seconds with:
```
✓ Compiled successfully
✓ Collecting page data
Route (app)                              Size
┌ ○ /                                    ...
├ ƒ /api/webhook                         ...
└ ƒ /api/cron/cleanup                    ...
```

If the build fails, the error is almost always a missing env var — check the Settings tab.

Once deployed, note your production URL (e.g. `https://mededbot-yourname.vercel.app`). You can also add a custom domain here if you want.

---

## 12. Wire up the LINE webhook

1. Back in <https://developers.line.biz/console/> → your channel → **Messaging API** tab.
2. **Webhook URL** → enter:
   ```
   https://mededbot-yourname.vercel.app/api/webhook
   ```
3. Click **Update**, then click **Verify** right below. You should see a green ✓ "Success" toast within ~2 seconds.
   - If you see a 400 error: signature mismatch — double-check `LINE_CHANNEL_SECRET` in Vercel.
   - If you see a timeout: the function may be cold-starting; click Verify again.
4. Toggle **Use webhook** → **ON**.

---

## 13. Smoke test from LINE

Open your LINE app → chat with the bot (you friended it in step 6.7).

Expected sequence:
1. Send any message. Bot replies with a "開始" quick-reply button.
2. Tap **🆕 開始**. Bot shows **🏥 衛教單張 / 💬 醫療翻譯** buttons.
3. Tap **🏥 衛教單張**. Bot shows a list of common diseases.
4. Tap **糖尿病** (or type anything). Bot shows "AI 生成約需 20 秒" and ~15–30s later returns a structured Chinese education sheet with a references bubble.
5. Tap **🌐 翻譯** → tap **🇬🇧 英文**. Bot returns an English translation.
6. Tap **📧 寄送** → type your email. Bot confirms delivery. Check your inbox for the formatted content.
7. Back to start, this time tap **💬 醫療翻譯** → pick **🇬🇧 英文** → type "我肚子痛". Bot returns plainified Chinese + English translation.
8. Tap **🔊 朗讀**. Bot returns an audio bubble.
9. Record and send a voice message. Bot transcribes and translates it.

If any step hangs or returns "系統發生錯誤":
- Open Vercel → project → **Logs** tab. Filter to `/api/webhook`. Read the error.
- Most likely culprits documented in [Troubleshooting](#14-troubleshooting) below.

---

## 14. Troubleshooting

### "Model not found" error on TTS

The Gemini TTS preview model (`gemini-2.5-flash-preview-tts`) may not be available in `us-central1` for your specific Vertex project. Check the current availability at <https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash>. If it's been renamed, update `TTS_MODEL` in `lib/gemini/tts.ts:7` and redeploy.

### LINE "Webhook verification failed"

1. Check `LINE_CHANNEL_SECRET` in Vercel — no spaces, no quotes.
2. Try Verify twice (cold-start headroom).
3. Hit `https://<domain>/api/webhook` with a browser — it should return `{"ok":true,"service":"mededbot-webhook"}`. If 500, the function has a missing env.

### Function times out at 60 seconds

You're on Hobby plan. Upgrade to Pro (for Fluid Compute + 300s) or reduce model usage. The typical long-path is edu-mode modify-with-search, which can take 50–80s.

### "No such table: chat_logs"

You skipped step 10. Run `npx drizzle-kit push` with `DATABASE_URL` pointed at the right DB.

### Audio message from user returns "無法辨識語音內容"

Either the STT call failed (check Vercel logs for a Vertex error) or the transcription came back empty. The Gemini STT model requires audio ≤ the LINE 10MB limit we enforce — anything weird (very quiet, pure noise) may transcribe to empty.

### Neon DB is paused

Free-tier Neon auto-pauses after 5 min of inactivity. The first request after a pause takes ~2 seconds longer as it wakes. Second+ requests are fast. Upgrade if this matters.

### Upstash Redis `ERR max daily request limit exceeded`

You're on the free Upstash tier (10k commands/day). One webhook = ~2 Redis commands (get + set). Each user turn is thus ~2. If you bust this, upgrade to Pay-as-you-go — the first 100k commands/day are pennies.

### Email delivery silently fails

1. `GMAIL_APP_PASSWORD` must be an **app password**, not your Gmail login password.
2. Check Gmail → Security → recent activity. Sometimes Google blocks the first SMTP attempt.
3. Emails may land in spam the first few times. Flag one as "Not Spam" to train the filter.

### Taigi TTS errors: "無法連接台語服務"

The NYCU iVoice service at `http://tts001.ivoice.tw:8804` is HTTP (not HTTPS) and is maintained by an academic team. Occasional downtime is normal. If it's consistently down, try it from your browser first to rule out platform issues.

---

## 15. Ongoing operations

- **Redeploy**: every push to `main` auto-deploys on Vercel. Pushes to other branches create preview URLs (the webhook still points at production).
- **Env var changes**: edit in Vercel dashboard, then click **Redeploy** on the latest deployment (env changes don't auto-propagate to already-running functions).
- **Service account rotation**: in Google Cloud → IAM → Service Accounts → Keys → revoke old key, create new, re-base64, update `GOOGLE_CREDS_B64` in Vercel, redeploy.
- **Log retention**: Vercel keeps function logs for 3 days on Hobby, longer on Pro. For long-term audit trails, rely on the `chat_logs` / `tts_logs` / `voicemail_logs` tables in Neon.
- **Cost**: expect < $5/month on typical usage if you're on Pro. The bulk is Vercel compute-hours; Vertex AI quota is usually free-tier compatible.

---

## 16. Rollback procedure

If a deploy breaks production:

1. Vercel → **Deployments** → find the previous good deploy → click `⋯` → **Promote to Production**. Takes ~5 seconds, zero downtime.
2. The LINE webhook URL doesn't change, so no reconfiguration needed.
3. Don't `git revert` under time pressure — promote first, investigate after.

---

## Appendix — minimal local dev

```bash
# Clone
git clone git@github.com:galencky/Mededbot-Vercel.git
cd Mededbot-Vercel
npm install

# Env
cp .env.example .env.local
# Fill in all the values from your scratch file

# Tunnel (pick one)
npx ngrok http 3000                 # https://xxxx.ngrok.io
# or: brew install cloudflare/cloudflare/cloudflared && cloudflared tunnel --url http://localhost:3000

# Run
npm run dev                         # http://localhost:3000

# Point LINE webhook to https://<ngrok-id>.ngrok.io/api/webhook
# Use the "Verify" button in the LINE console to confirm
```

Remember to switch the LINE webhook back to your production URL when you're done testing. Or use a separate LINE channel for dev.
