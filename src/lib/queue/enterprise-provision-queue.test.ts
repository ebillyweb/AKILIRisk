import { describe, expect, it } from "vitest";

import { enterpriseProvisionJobId } from "@/lib/queue/enterprise-provision-queue";
import { isRedisConfigured } from "@/lib/queue/redis-connection";

describe("enterpriseProvisionJobId", () => {
  it("uses a stable id per enterprise", () => {
    expect(enterpriseProvisionJobId("ent_abc")).toBe("provision:ent_abc");
  });
});

describe("isRedisConfigured", () => {
  it("is true when Upstash REST env vars are set", () => {
    expect(
      isRedisConfigured({
        UPSTASH_REDIS_REST_URL: "https://us1-example.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "token",
      }),
    ).toBe(true);
  });

  it("is false when REDIS_URL and Upstash vars are unset", () => {
    expect(isRedisConfigured({})).toBe(false);
  });
});
