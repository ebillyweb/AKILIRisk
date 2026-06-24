import { test, expect } from "@playwright/test";
import { isTestAuthEnabled } from "../helpers/test-auth";

/**
 * Verifies intake and assessment methodology snapshots stay pinned after advisor edits.
 * Requires ENABLE_TEST_AUTH=1 (see tests/helpers/test-auth.ts).
 */
test.describe("methodology snapshot integrity", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await isTestAuthEnabled(request)), "ENABLE_TEST_AUTH is not enabled");
  });

  test("mid-intake: advisor intake edits do not change snapshotted client script", async ({
    request,
  }) => {
    const clientEmail = "client-fresh@test.com";
    const advisorEmail = "advisor@test.com";
    const marker = `SNAPSHOT-PINNED-${Date.now()}`;

    const reset = await request.post("/api/test/methodology/prepare", {
      data: { action: "reset-intake", clientEmail },
    });
    expect(reset.status()).toBe(200);

    const start = await request.post("/api/test/methodology/prepare", {
      data: { action: "start-intake-snapshot", clientEmail },
    });
    expect(start.status()).toBe(200);
    const started = (await start.json()) as {
      questions: Array<{ id: string; questionText: string }>;
    };
    expect(started.questions.length).toBeGreaterThan(0);

    const target = started.questions[0];
    const patch = await request.post("/api/test/methodology/prepare", {
      data: {
        action: "patch-advisor-intake",
        advisorEmail,
        questionId: target.id,
        questionText: `${marker} ${target.questionText}`,
      },
    });
    expect(patch.status()).toBe(200);

    const script = await request.post("/api/test/methodology/prepare", {
      data: { action: "get-intake-script", clientEmail },
    });
    expect(script.status()).toBe(200);
    const pinned = (await script.json()) as {
      questions: Array<{ id: string; questionText: string }>;
    };
    const pinnedRow = pinned.questions.find((q) => q.id === target.id);
    expect(pinnedRow?.questionText).toBe(target.questionText);
    expect(pinnedRow?.questionText).not.toContain(marker);
  });

  test("mid-assessment: advisor narrative edits do not change pinned pillar narratives", async ({
    request,
  }) => {
    const clientEmail = "client@test.com";
    const advisorEmail = "advisor@test.com";
    const pillar = "governance";
    const marker = `NARRATIVE-PINNED-${Date.now()}`;

    const scored = await request.post("/api/test/methodology/prepare", {
      data: { action: "ensure-scored-pillar", clientEmail, pillar },
    });
    expect(scored.status()).toBe(200);
    const { assessmentId } = (await scored.json()) as { assessmentId: string };

    const before = await request.post("/api/test/methodology/prepare", {
      data: { action: "get-pillar-narratives", assessmentId, pillar },
    });
    expect(before.status()).toBe(200);
    const beforeBody = (await before.json()) as { narratives: string[] };
    expect(beforeBody.narratives.length).toBeGreaterThan(0);

    const patch = await request.post("/api/test/methodology/prepare", {
      data: {
        action: "patch-advisor-narrative",
        advisorEmail,
        pillar,
        allNegative: [marker, ...beforeBody.narratives],
      },
    });
    expect(patch.status()).toBe(200);

    const after = await request.post("/api/test/methodology/prepare", {
      data: { action: "get-pillar-narratives", assessmentId, pillar },
    });
    expect(after.status()).toBe(200);
    const afterBody = (await after.json()) as { narratives: string[] };
    expect(afterBody.narratives).toEqual(beforeBody.narratives);
    expect(afterBody.narratives.join(" ")).not.toContain(marker);
  });
});
