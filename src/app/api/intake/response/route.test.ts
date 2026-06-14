/**
 * Handler test for POST /api/intake/response.
 *
 * Prisma and the user resolver are mocked because no Postgres is provisioned in
 * this environment; the test still exercises the route end-to-end — auth gating,
 * payload validation, ownership, and the server-wins conflict rule (plan §8.2).
 * To run against a real DB, point DATABASE_URL at a test database and replace
 * the `@/lib/db` mock with the real client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { resolveUser, prismaMock } = vi.hoisted(() => ({
  resolveUser: vi.fn(),
  prismaMock: {
    intakeInterview: { findFirst: vi.fn(), update: vi.fn() },
    intakeResponse: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/mobile/token", () => ({ resolveUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "./route";

const USER = { id: "user-1", email: "c@example.com", role: "USER" as const };

function postRequest(body: unknown) {
  return new Request("http://localhost/api/intake/response", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveUser.mockResolvedValue(USER);
  prismaMock.intakeInterview.findFirst.mockResolvedValue({
    id: "intv-1",
    status: "IN_PROGRESS",
  });
  prismaMock.intakeResponse.findUnique.mockResolvedValue(null);
  prismaMock.intakeResponse.upsert.mockResolvedValue({});
  prismaMock.intakeInterview.update.mockResolvedValue({});
});

const validType = {
  interviewId: "intv-1",
  questionId: "intake-q1",
  mode: "TYPE",
  text: "Our family council meets quarterly.",
  updatedAt: "2026-06-14T12:00:00Z",
};

describe("POST /api/intake/response", () => {
  it("returns 401 when unauthenticated", async () => {
    resolveUser.mockResolvedValue(null);
    const res = await POST(postRequest(validType));
    expect(res.status).toBe(401);
    expect(prismaMock.intakeResponse.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid payload", async () => {
    const res = await POST(postRequest({ interviewId: "intv-1", mode: "TYPE" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a TYPE answer with no text", async () => {
    const res = await POST(postRequest({ ...validType, text: "   " }));
    expect(res.status).toBe(400);
    expect(prismaMock.intakeResponse.upsert).not.toHaveBeenCalled();
  });

  it("returns 404 when the interview is not owned by the user", async () => {
    prismaMock.intakeInterview.findFirst.mockResolvedValue(null);
    const res = await POST(postRequest(validType));
    expect(res.status).toBe(404);
  });

  it("skips a stale write without upserting (server is newer)", async () => {
    prismaMock.intakeResponse.findUnique.mockResolvedValue({
      updatedAt: new Date("2026-06-14T12:05:00Z"),
    });
    const res = await POST(postRequest(validType)); // client ts is 12:00, older
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, skipped: true });
    expect(prismaMock.intakeResponse.upsert).not.toHaveBeenCalled();
  });

  it("upserts a fresh TYPE answer", async () => {
    const res = await POST(postRequest(validType));
    expect(res.status).toBe(200);
    expect(prismaMock.intakeResponse.upsert).toHaveBeenCalledTimes(1);
    const arg = prismaMock.intakeResponse.upsert.mock.calls[0][0];
    expect(arg.create.textResponse).toBe(validType.text);
    expect(arg.create.audioUrl).toBeNull();
  });

  it("upserts a VOICE answer with the file key and pending transcription", async () => {
    const res = await POST(
      postRequest({
        interviewId: "intv-1",
        questionId: "intake-q1",
        mode: "VOICE",
        fileKey: "intake/intv-1/intake-q1/123.m4a",
        updatedAt: "2026-06-14T12:00:00Z",
      }),
    );
    expect(res.status).toBe(200);
    const arg = prismaMock.intakeResponse.upsert.mock.calls[0][0];
    expect(arg.create.audioUrl).toBe("intake/intv-1/intake-q1/123.m4a");
    expect(arg.create.transcriptionStatus).toBe("PENDING");
  });

  it("promotes a NOT_STARTED interview to IN_PROGRESS on first answer", async () => {
    prismaMock.intakeInterview.findFirst.mockResolvedValue({
      id: "intv-1",
      status: "NOT_STARTED",
    });
    await POST(postRequest(validType));
    expect(prismaMock.intakeInterview.update).toHaveBeenCalledTimes(1);
    const arg = prismaMock.intakeInterview.update.mock.calls[0][0];
    expect(arg.data.status).toBe("IN_PROGRESS");
  });
});
