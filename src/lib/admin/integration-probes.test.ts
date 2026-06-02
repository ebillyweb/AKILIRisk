import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import dns from "node:dns/promises";

const { mockS3Send, mockBalanceRetrieve } = vi.hoisted(() => ({
  mockS3Send: vi.fn(),
  mockBalanceRetrieve: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {
    send(command: unknown) {
      return mockS3Send(command);
    }
  },
  HeadBucketCommand: class HeadBucketCommand {
    constructor(public input: { Bucket: string }) {}
  },
}));

vi.mock("stripe", () => {
  class StripeAuthenticationError extends Error {}
  class Stripe {
    balance = { retrieve: mockBalanceRetrieve };
     
    constructor(_key: string, _options?: unknown) {}
    static errors = { StripeAuthenticationError };
  }
  return { default: Stripe };
});

import {
  integrationProbesToDependencies,
  probeOpenAI,
  probeResend,
  probeS3,
  probeStripe,
  probeWhiteLabelDns,
  probeResultToServiceHealth,
  runIntegrationProbes,
} from "@/lib/admin/integration-probes";

const envBackup = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...envBackup };
  mockS3Send.mockReset();
  mockBalanceRetrieve.mockReset();
});

afterEach(() => {
  process.env = { ...envBackup };
});

describe("probeStripe", () => {
  it("returns not_configured when STRIPE_SECRET_KEY is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const result = await probeStripe();
    expect(result.status).toBe("not_configured");
    expect(mockBalanceRetrieve).not.toHaveBeenCalled();
  });

  it("returns healthy when balance.retrieve succeeds", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    mockBalanceRetrieve.mockResolvedValue({});
    const result = await probeStripe();
    expect(result.status).toBe("healthy");
    expect(mockBalanceRetrieve).toHaveBeenCalled();
  });
});

describe("probeOpenAI", () => {
  it("returns not_configured without OPENAI_API_KEY", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await probeOpenAI();
    expect(result.status).toBe("not_configured");
  });

  it("returns healthy on HTTP 200", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );
    const result = await probeOpenAI();
    expect(result.status).toBe("healthy");
  });

  it("returns down on HTTP 401", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    );
    const result = await probeOpenAI();
    expect(result.status).toBe("down");
  });
});

describe("probeResend", () => {
  it("returns healthy on domains HTTP 200", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );
    const result = await probeResend();
    expect(result.status).toBe("healthy");
    expect(result.message).toContain("domains list");
  });

  it("returns down on HTTP 403 when key is invalid (not send-only)", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ name: "invalid_api_key" }),
      })
    );
    const result = await probeResend();
    expect(result.status).toBe("down");
  });

  it("falls back to send probe when key is send-only restricted", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          name: "restricted_api_key",
          message: "This API key is restricted to only send emails",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: "Missing `to` field." }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const result = await probeResend();
    expect(result.status).toBe("healthy");
    expect(result.message).toContain("send-only");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.resend.com/emails");
  });
});

describe("probeS3", () => {
  it("returns not_configured when any required bucket env is missing", async () => {
    delete process.env.S3_BRANDING_BUCKET;
    delete process.env.S3_INTAKE_BUCKET;
    delete process.env.S3_BUCKET_NAME;
    const result = await probeS3();
    expect(result.status).toBe("not_configured");
    expect(result.message).toContain("S3_BRANDING_BUCKET");
    expect(result.message).toContain("S3_INTAKE_BUCKET");
    expect(result.message).toContain("S3_BUCKET_NAME");
  });

  it("returns healthy when HeadBucket succeeds for all buckets", async () => {
    process.env.S3_BRANDING_BUCKET = "akili-advisor-assets";
    process.env.S3_INTAKE_BUCKET = "akili-intake-audio";
    process.env.S3_BUCKET_NAME = "akili-advisor-assets";
    process.env.AWS_ACCESS_KEY_ID = "AKIA";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    process.env.AWS_REGION = "us-east-2";
    mockS3Send.mockResolvedValue({});
    const result = await probeS3();
    expect(result.status).toBe("healthy");
    expect(mockS3Send).toHaveBeenCalled();
    expect(result.message).toContain("akili-advisor-assets");
    expect(result.message).toContain("akili-intake-audio");
  });

  it("returns down on access denied", async () => {
    process.env.S3_BRANDING_BUCKET = "my-bucket";
    process.env.S3_INTAKE_BUCKET = "my-intake";
    process.env.S3_BUCKET_NAME = "my-bucket";
    process.env.AWS_ACCESS_KEY_ID = "AKIA";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    mockS3Send.mockRejectedValue(new Error("AccessDenied"));
    const result = await probeS3();
    expect(result.status).toBe("down");
  });

  it("returns down when bucket is not found (404 / NotFound)", async () => {
    process.env.S3_BRANDING_BUCKET = "missing-bucket";
    process.env.S3_INTAKE_BUCKET = "missing-intake";
    process.env.S3_BUCKET_NAME = "missing-bucket";
    process.env.AWS_ACCESS_KEY_ID = "AKIA";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    const notFound = Object.assign(new Error("Unknown"), {
      name: "NotFound",
      $metadata: { httpStatusCode: 404 },
    });
    mockS3Send.mockRejectedValue(notFound);
    const result = await probeS3();
    expect(result.status).toBe("down");
    expect(result.message).toContain("missing-bucket");
    expect(result.message).toContain("not found");
  });
});

describe("probeWhiteLabelDns", () => {
  it("returns not_configured without PRODUCTION_DOMAIN", async () => {
    delete process.env.PRODUCTION_DOMAIN;
    const result = await probeWhiteLabelDns();
    expect(result.status).toBe("not_configured");
  });

  it("returns healthy when DNS and HTTP succeed", async () => {
    process.env.PRODUCTION_DOMAIN = "akilirisk.com";
    vi.spyOn(dns, "lookup").mockResolvedValue({ address: "1.2.3.4", family: 4 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );
    const result = await probeWhiteLabelDns();
    expect(result.status).toBe("healthy");
    expect(result.message).toContain("Per-advisor CNAME");
  });
});

describe("probeResultToServiceHealth", () => {
  it("maps not_configured to unknown with configured=false", () => {
    const row = probeResultToServiceHealth({
      id: "openai",
      status: "not_configured",
      message: "missing key",
      checkedAt: "2026-05-18T12:00:00.000Z",
    });
    expect(row.status).toBe("unknown");
    expect(row.configured).toBe(false);
    expect(row.probedAt).toBe("2026-05-18T12:00:00.000Z");
  });
});

describe("runIntegrationProbes", () => {
  it("returns five probe rows in stable order", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.RESEND_API_KEY;
    delete process.env.S3_BRANDING_BUCKET;
    delete process.env.S3_BUCKET_NAME;
    delete process.env.PRODUCTION_DOMAIN;

    const results = await runIntegrationProbes();
    expect(results).toHaveLength(5);
    expect(results.map((r) => r.id)).toEqual([
      "stripe",
      "openai",
      "resend",
      "s3",
      "white-label-dns",
    ]);
    expect(results.every((r) => r.status === "not_configured")).toBe(true);
  });
});

describe("integrationProbesToDependencies", () => {
  it("preserves probe order for operations snapshot", () => {
    const deps = integrationProbesToDependencies([
      {
        id: "s3",
        status: "healthy",
        checkedAt: "2026-05-18T12:00:00.000Z",
      },
      {
        id: "stripe",
        status: "not_configured",
        checkedAt: "2026-05-18T12:00:00.000Z",
      },
    ]);
    expect(deps.map((d) => d.id)).toEqual(["stripe", "s3"]);
  });
});
