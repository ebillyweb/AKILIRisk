/**
 * Real-database integration test for POST /api/intake/response.
 *
 * Opt-in: runs only when TEST_DATABASE_URL points at a throwaway Postgres with
 * the schema applied. Otherwise the whole suite is skipped (so CI without a DB
 * stays green). To run:
 *
 *   TEST_DATABASE_URL=postgres://... npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgres://... npx vitest run src/app/api/intake/response/route.integration.test.ts
 *
 * Only the user resolver is mocked (auth); the real Prisma client hits the DB,
 * so this exercises the upsert, the unique (interviewId, questionId) constraint,
 * and the server-wins conflict rule against actual SQL.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;

const { resolveUser } = vi.hoisted(() => ({ resolveUser: vi.fn() }));
vi.mock("@/lib/mobile/token", () => ({ resolveUser }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

function postRequest(body: unknown) {
  return new Request("http://localhost/api/intake/response", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

describe.skipIf(!TEST_DB)("POST /api/intake/response (real DB)", () => {
  let POST: AnyFn;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  const suffix = Date.now();
  const email = `intake-it-${suffix}@example.com`;
  let userId: string;
  let interviewId: string;
  const questionId = "intake-q1";

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ POST } = await import("./route"));
    ({ prisma } = await import("@/lib/db"));

    const user = await prisma.user.create({
      data: { email, password: "x", name: "Integration Tester", role: "USER" },
    });
    userId = user.id;
    const interview = await prisma.intakeInterview.create({
      data: { userId, status: "NOT_STARTED" },
    });
    interviewId = interview.id;

    resolveUser.mockResolvedValue({ id: userId, email, role: "USER" });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.intakeResponse.deleteMany({ where: { interviewId } }).catch(() => {});
    await prisma.intakeInterview.deleteMany({ where: { id: interviewId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it("persists a typed answer and promotes the interview to IN_PROGRESS", async () => {
    const res = await POST(
      postRequest({
        interviewId,
        questionId,
        mode: "TYPE",
        text: "We hold quarterly family council meetings.",
        updatedAt: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(200);

    const saved = await prisma.intakeResponse.findUnique({
      where: { interviewId_questionId: { interviewId, questionId } },
    });
    expect(saved?.textResponse).toBe("We hold quarterly family council meetings.");

    const interview = await prisma.intakeInterview.findUnique({ where: { id: interviewId } });
    expect(interview?.status).toBe("IN_PROGRESS");
  });

  it("discards a stale write (server value is newer)", async () => {
    const before = await prisma.intakeResponse.findUnique({
      where: { interviewId_questionId: { interviewId, questionId } },
    });

    const res = await POST(
      postRequest({
        interviewId,
        questionId,
        mode: "TYPE",
        text: "stale overwrite that should be ignored",
        updatedAt: "2000-01-01T00:00:00Z", // far older than the stored value
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, skipped: true });

    const after = await prisma.intakeResponse.findUnique({
      where: { interviewId_questionId: { interviewId, questionId } },
    });
    expect(after?.textResponse).toBe(before?.textResponse);
  });
});
