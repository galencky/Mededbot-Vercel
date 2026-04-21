import { GoogleGenAI } from "@google/genai";
import { env } from "../env";

interface ServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
}

let _client: GoogleGenAI | null = null;

function decodeServiceAccount(): ServiceAccount {
  const raw = env.GOOGLE_CREDS_B64;
  let json: string;
  try {
    json = Buffer.from(raw, "base64").toString("utf8");
  } catch {
    throw new Error("GOOGLE_CREDS_B64 is not valid base64");
  }
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(json) as ServiceAccount;
  } catch {
    throw new Error("GOOGLE_CREDS_B64 did not decode to valid JSON");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "Service account JSON missing client_email or private_key",
    );
  }
  // Guard against env-var mangling of newlines.
  if (parsed.private_key.includes("\\n") && !parsed.private_key.includes("\n")) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

export function geminiClient(): GoogleGenAI {
  if (_client) return _client;

  const sa = decodeServiceAccount();
  const project = env.VERTEX_PROJECT_ID || sa.project_id;
  if (!project) {
    throw new Error(
      "Vertex AI project id missing — set VERTEX_PROJECT_ID or include project_id in GOOGLE_CREDS_B64",
    );
  }

  _client = new GoogleGenAI({
    vertexai: true,
    project,
    location: env.VERTEX_LOCATION,
    googleAuthOptions: {
      credentials: {
        client_email: sa.client_email!,
        private_key: sa.private_key!,
      },
    },
  });
  return _client;
}
