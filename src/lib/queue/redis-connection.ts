import "server-only";

import type { ConnectionOptions } from "bullmq";

type RedisEnv = {
  REDIS_URL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  KV_REST_API_URL?: string;
  KV_REST_API_TOKEN?: string;
};

/** @internal Exported for unit tests. */
export function resolveBullMqConnectionFromEnv(
  env: RedisEnv = process.env,
): ConnectionOptions | null {
  const explicitUrl = env.REDIS_URL?.trim();
  if (explicitUrl) {
    return {
      url: explicitUrl,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  const restUrl = env.UPSTASH_REDIS_REST_URL?.trim() || env.KV_REST_API_URL?.trim();
  const token =
    env.UPSTASH_REDIS_REST_TOKEN?.trim() || env.KV_REST_API_TOKEN?.trim();
  if (!restUrl || !token) {
    return null;
  }

  let host: string;
  try {
    host = new URL(restUrl).hostname;
  } catch {
    return null;
  }

  if (!host) return null;

  return {
    host,
    port: 6379,
    password: token,
    tls: {},
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function isRedisConfigured(env: RedisEnv = process.env): boolean {
  return resolveBullMqConnectionFromEnv(env) !== null;
}

export function getBullMqConnection(): ConnectionOptions {
  const connection = resolveBullMqConnectionFromEnv();
  if (!connection) {
    throw new Error(
      "Redis is not configured. Set REDIS_URL or connect Upstash on Vercel (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).",
    );
  }
  return connection;
}
