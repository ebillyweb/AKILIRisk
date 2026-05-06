import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Round-11 session-2: tests for the test-only magic-link issuance endpoint.
 *
 * Mocks issueMagicLinkToken + writeAudit + the env vars. Asserts both
 * gates (NODE_ENV + ENABLE_TEST_AUTH) plus the audit metadata.testOrigin
 * flag.
 */

const { issueSpy, writeAuditSpy } = vi.hoisted(() => ({
  issueSpy: vi.fn(),
  writeAuditSpy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/magic-link", () => ({
  issueMagicLinkToken: (...args: unknown[]) => issueSpy(...args),
}));

vi.mock("@/lib/audit/audit-log", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit/audit-log")>(
    "@/lib/audit/audit-log"
  );
  return { ...actual, writeAudit: (...args: unknown[]) => writeAuditSpy(...args) };
});

import { POST } from "./route";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-log";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_ENABLE = process.env.ENABLE_TEST_AUTH;
const ORIGINAL_PUBLIC_URL = process.env.NEXT_PUBLIC_URL;

beforeEach(() => {
  issueSpy.mockReset();
  writeAuditSpy.mockClear();
  process.env.NODE_ENV = "test";
  process.env.ENABLE_TEST_AUTH = "1";
  process.env.NEXT_PUBLIC_URL = "https://preview.akilirisk.com";
});

afterEach(() => {
  if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_ENABLE === undefined) delete process.env.ENABLE_TEST_AUTH;
  else process.env.ENABLE_TEST_AUTH = ORIGINAL_ENABLE;
  if (ORIGINAL_PUBLIC_URL === undefined) delete process.env.NEXT_PUBLIC_URL;
  else process.env.NEXT_PUBLIC_URL = ORIGINAL_PUBLIC_URL;
});

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/test/magic-link/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("/api/test/magic-link/issue — gating", () => {
  it("returns 404 when NODE_ENV='production' regardless of ENABLE_TEST_AUTH", async () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_TEST_AUTH = "1";

    const res = await POST(makeRequest({ email: "alice@example.com" }));
    expect(res.status).toBe(404);
    expect(issueSpy).not.toHaveBeenCalled();
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });

  it("returns 404 when ENABLE_TEST_AUTH !== '1' regardless of NODE_ENV", async () => {
    process.env.NODE_ENV = "test";
    process.env.ENABLE_TEST_AUTH = "0";

    const res = await POST(makeRequest({ email: "alice@example.com" }));
    expect(res.status).toBe(404);
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it("returns 404 when ENABLE_TEST_AUTH is unset", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.ENABLE_TEST_AUTH;

    const res = await POST(makeRequest({ email: "alice@example.com" }));
    expect(res.status).toBe(404);
  });
});

describe("/api/test/magic-link/issue — happy path", () => {
  beforeEach(() => {
    issueSpy.mockResolvedValue({
      rawToken: "abc123def456",
      tokenId: "mlt-test-1",
      expires: new Date("2030-01-01T00:00:00Z"),
    });
  });

  it("returns 200 + rawToken + verifyUrl + expires", async () => {
    const res = await POST(makeRequest({ email: "alice@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rawToken).toBe("abc123def456");
    expect(body.verifyUrl).toBe(
      "https://preview.akilirisk.com/auth/magic-link/verify?token=abc123def456"
    );
    expect(body.expires).toBe("2030-01-01T00:00:00.000Z");
  });

  it("calls issueMagicLinkToken once with the input email", async () => {
    await POST(makeRequest({ email: "alice@example.com" }));
    expect(issueSpy).toHaveBeenCalledTimes(1);
    expect(issueSpy).toHaveBeenCalledWith("alice@example.com");
  });

  it("writes an audit row with metadata.testOrigin: true", async () => {
    await POST(makeRequest({ email: "alice@example.com" }));
    expect(writeAuditSpy).toHaveBeenCalledTimes(1);
    const auditCall = writeAuditSpy.mock.calls[0][0];
    expect(auditCall.action).toBe(AUDIT_ACTIONS.AUTH_MAGIC_LINK_REQUEST);
    expect(auditCall.entityType).toBe("User");
    expect(auditCall.metadata.testOrigin).toBe(true);
    expect(auditCall.metadata.route).toBe("/api/test/magic-link/issue");
    expect(auditCall.metadata.tokenId).toBe("mlt-test-1");
  });

  it("falls back to localhost base URL when NEXT_PUBLIC_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_URL;
    const res = await POST(makeRequest({ email: "alice@example.com" }));
    const body = await res.json();
    expect(body.verifyUrl).toBe(
      "http://localhost:3000/auth/magic-link/verify?token=abc123def456"
    );
  });
});

describe("/api/test/magic-link/issue — input validation", () => {
  it("returns 400 for a malformed email", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it("returns 400 for missing body", async () => {
    const req = new Request("http://localhost:3000/api/test/magic-link/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    }) as never;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
