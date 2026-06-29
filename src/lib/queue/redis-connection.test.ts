import { describe, expect, it } from "vitest";

import {
  isRedisConfigured,
  resolveBullMqConnectionFromEnv,
} from "@/lib/queue/redis-connection";

describe("resolveBullMqConnectionFromEnv", () => {
  it("prefers explicit REDIS_URL", () => {
    const connection = resolveBullMqConnectionFromEnv({
      REDIS_URL: "rediss://default:secret@host.upstash.io:6379",
      UPSTASH_REDIS_REST_URL: "https://ignored.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "ignored",
    });

    expect(connection).toEqual({
      url: "rediss://default:secret@host.upstash.io:6379",
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  });

  it("builds TCP settings from Vercel Upstash REST env vars", () => {
    const connection = resolveBullMqConnectionFromEnv({
      UPSTASH_REDIS_REST_URL: "https://us1-example-12345.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "AXXXabc",
    });

    expect(connection).toEqual({
      host: "us1-example-12345.upstash.io",
      port: 6379,
      password: "AXXXabc",
      tls: {},
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  });

  it("supports legacy KV_REST_* vars from migrated Vercel KV", () => {
    const connection = resolveBullMqConnectionFromEnv({
      KV_REST_API_URL: "https://eu2-legacy-99999.upstash.io",
      KV_REST_API_TOKEN: "legacy-token",
    });

    expect(connection).toMatchObject({
      host: "eu2-legacy-99999.upstash.io",
      password: "legacy-token",
    });
  });

  it("returns null when no redis env is present", () => {
    expect(resolveBullMqConnectionFromEnv({})).toBeNull();
    expect(isRedisConfigured({})).toBe(false);
  });
});
