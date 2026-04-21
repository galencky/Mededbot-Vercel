function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Vertex AI (replaces direct Gemini API key auth)
  get GOOGLE_CREDS_B64() {
    return required("GOOGLE_CREDS_B64");
  },
  get VERTEX_PROJECT_ID() {
    return optional("VERTEX_PROJECT_ID");
  },
  get VERTEX_LOCATION() {
    return optional("VERTEX_LOCATION", "us-central1");
  },

  get LINE_CHANNEL_SECRET() {
    return required("LINE_CHANNEL_SECRET");
  },
  get LINE_CHANNEL_ACCESS_TOKEN() {
    return required("LINE_CHANNEL_ACCESS_TOKEN");
  },
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get UPSTASH_REDIS_REST_URL() {
    return required("UPSTASH_REDIS_REST_URL");
  },
  get UPSTASH_REDIS_REST_TOKEN() {
    return required("UPSTASH_REDIS_REST_TOKEN");
  },
  get BLOB_READ_WRITE_TOKEN() {
    return required("BLOB_READ_WRITE_TOKEN");
  },
  get GMAIL_ADDRESS() {
    return required("GMAIL_ADDRESS");
  },
  get GMAIL_APP_PASSWORD() {
    return required("GMAIL_APP_PASSWORD");
  },
  get CRON_SECRET() {
    return optional("CRON_SECRET");
  },
  get LOG_LEVEL() {
    return optional("LOG_LEVEL", "info");
  },
};
