import "server-only";

import type { ConnectionOptions } from "bullmq";

type RedisEnv = {
  REDIS_URL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  KV_REST_API_URL?: string;
  KV_REST_API_TOKEN?: string;
};

function readRedisEnvFromProcess(): RedisEnv {
  return {
    REDIS_URL: process.env.REDIS_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  };
}

/** @internal Exported for unit tests. */
export function resolveBullMqConnectionFromEnv(
  env?: RedisEnv,
): ConnectionOptions | null {
  const resolved = env ?? readRedisEnvFromProcess();
  const explicitUrl = resolved.REDIS_URL?.trim();
  if (explicitUrl) {
    return {
      url: explicitUrl,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  const restUrl =
    resolved.UPSTASH_REDIS_REST_URL?.trim() || resolved.KV_REST_API_URL?.trim();
  const token =
    resolved.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    resolved.KV_REST_API_TOKEN?.trim();
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

export function isRedisConfigured(env?: RedisEnv): boolean {
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
