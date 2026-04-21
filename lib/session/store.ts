import { Redis } from "@upstash/redis";
import { env } from "../env";
import type { Session } from "./types";

const SESSION_TTL_SECONDS = 86400; // 24 hours

let _redis: Redis | null = null;
function redis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

const key = (userId: string) => `session:${userId}`;

export async function getSession(userId: string): Promise<Session> {
  const data = await redis().get<Session>(key(userId));
  return data ?? {};
}

export async function saveSession(userId: string, session: Session): Promise<void> {
  await redis().set(key(userId), session, { ex: SESSION_TTL_SECONDS });
}

export async function clearSession(userId: string): Promise<void> {
  await redis().del(key(userId));
}
