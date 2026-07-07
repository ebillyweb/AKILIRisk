import { test, expect } from "@playwright/test";
import { isTestAuthEnabled } from "../helpers/test-auth";

/**
 * Advisor-owned custom questions vs platform base questions.
 * Requires ENABLE_TEST_AUTH=1.
 */
test.describe("advisor custom methodology questions", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await isTestAuthEnabled(request)), "ENABLE_TEST_AUTH is not enabled");
  });

  test("custom intake question appears in client snapshot; platform base cannot be deleted", async ({
    request,
  }) => {
    const clientEmail = "client-fresh@test.com";
    const advisorEmail = "advisor@test.com";
    const customText = `CUSTOM-INTAKE-${Date.now()}`;

    await request.post("/api/test/methodology/prepare", {
      data: { action: "reset-intake", clientEmail },
    });

    const created = await request.post("/api/test/methodology/prepare", {
      data: {
        action: "create-custom-intake",
        advisorEmail,
        questionText: customText,
      },
    });
    expect(created.status()).toBe(200);
    const custom = (await created.json()) as { questionId: string };

    const started = await request.post("/api/test/methodology/prepare", {
      data: { action: "start-intake-snapshot", clientEmail },
    });
    expect(started.status()).toBe(200);
    const startBody = (await started.json()) as {
      questions: Array<{ id: string; questionText: string }>;
    };
    const texts = startBody.questions.map((q) => q.questionText);
    expect(texts).toContain(customText);

    const platformId = startBody.questions.find((q) => q.id !== custom.questionId)?.id;
    expect(platformId).toBeTruthy();

    const blocked = await request.post("/api/test/methodology/prepare", {
      data: {
        action: "try-delete-advisor-intake",
        advisorEmail,
        questionId: platformId,
      },
    });
    expect(blocked.status()).toBe(200);
    const blockedBody = (await blocked.json()) as { deleted: boolean; error?: string };
    expect(blockedBody.deleted).toBe(false);
    expect(blockedBody.error).toMatch(/cannot be deleted/i);

    const allowed = await request.post("/api/test/methodology/prepare", {
      data: {
        action: "try-delete-advisor-intake",
        advisorEmail,
        questionId: custom.questionId,
      },
    });
    expect(allowed.status()).toBe(200);
    const allowedBody = (await allowed.json()) as { deleted: boolean };
    expect(allowedBody.deleted).toBe(true);
  });

  test("choice_list custom intake round-trips options and formats selected label", async ({
    request,
  }) => {
    const clientEmail = "client-fresh@test.com";
    const advisorEmail = "advisor@test.com";
    const customText = `CUSTOM-CHOICE-${Date.now()}`;

    await request.post("/api/test/methodology/prepare", {
      data: { action: "reset-intake", clientEmail },
    });

    const created = await request.post("/api/test/methodology/prepare", {
      data: {
        action: "create-custom-choice-list-intake",
        advisorEmail,
        questionText: customText,
        optionLabels: ["Retired", "Employed", "Student"],
      },
    });
    expect(created.status()).toBe(200);
    const custom = (await created.json()) as {
      questionId: string;
      answerType: string;
      options: Array<{ value: string; label: string }>;
    };
    expect(custom.answerType).toBe("choice_list");
    expect(custom.options).toHaveLength(3);

    const started = await request.post("/api/test/methodology/prepare", {
      data: { action: "start-intake-snapshot", clientEmail },
    });
    expect(started.status()).toBe(200);
    const startBody = (await started.json()) as {
      questions: Array<{
        id: string;
        questionText: string;
        answerType: string;
        options: Array<{ value: string; label: string }> | null;
      }>;
    };
    const snapQuestion = startBody.questions.find((q) => q.id === custom.questionId);
    expect(snapQuestion?.answerType).toBe("choice_list");
    expect(snapQuestion?.options).toEqual(custom.options);

    await request.post("/api/test/methodology/prepare", {
      data: {
        action: "record-intake-structured-answer",
        clientEmail,
        questionId: custom.questionId,
        value: "1",
      },
    });

    const formatted = await request.post("/api/test/methodology/prepare", {
      data: {
        action: "get-formatted-intake-answer",
        clientEmail,
        questionId: custom.questionId,
      },
    });
    expect(formatted.status()).toBe(200);
    const formattedBody = (await formatted.json()) as {
      answerText: string;
      answerKind: string;
      answerLabel?: string;
    };
    expect(formattedBody.answerText).toBe("Employed");
    expect(formattedBody.answerKind).toBe("structured_choice");
    expect(formattedBody.answerLabel).toBe("Selected option");
  });

  test("hidden platform intake question is excluded from new client snapshot", async ({
    request,
  }) => {
    const clientEmail = "client-fresh@test.com";
    const advisorEmail = "advisor@test.com";

    await request.post("/api/test/methodology/prepare", {
      data: { action: "reset-intake", clientEmail },
    });

    const peek = await request.post("/api/test/methodology/prepare", {
      data: { action: "start-intake-snapshot", clientEmail },
    });
    const peekBody = (await peek.json()) as {
      questions: Array<{ id: string; questionText: string }>;
    };
    const target = peekBody.questions[0];
    expect(target).toBeTruthy();

    await request.post("/api/test/methodology/prepare", {
      data: { action: "reset-intake", clientEmail },
    });

    await request.post("/api/test/methodology/prepare", {
      data: {
        action: "hide-advisor-intake",
        advisorEmail,
        questionId: target.id,
      },
    });

    const started = await request.post("/api/test/methodology/prepare", {
      data: { action: "start-intake-snapshot", clientEmail },
    });
    const startedBody = (await started.json()) as {
      questions: Array<{ id: string; questionText: string }>;
    };
    expect(startedBody.questions.find((q) => q.id === target.id)).toBeUndefined();
  });

  test("custom recommendation rule appears in snapshot; platform rule cannot be deleted", async ({
    request,
  }) => {
    const clientEmail = "client-fresh@test.com";
    const advisorEmail = "advisor@test.com";
    const customName = `CUSTOM-REC-${Date.now()}`;

    await request.post("/api/test/methodology/prepare", {
      data: { action: "reset-intake", clientEmail },
    });

    const created = await request.post("/api/test/methodology/prepare", {
      data: {
        action: "create-custom-rec-rule",
        advisorEmail,
        pillar: "governance",
        name: customName,
      },
    });
    expect(created.status()).toBe(200);
    const custom = (await created.json()) as { ruleId: string };

    await request.post("/api/test/methodology/prepare", {
      data: { action: "start-intake-snapshot", clientEmail },
    });

    const rulesRes = await request.post("/api/test/methodology/prepare", {
      data: { action: "get-snapshot-rec-rules", clientEmail },
    });
    expect(rulesRes.status()).toBe(200);
    const rulesBody = (await rulesRes.json()) as { ruleNames: string[]; rules: { id: string }[] };
    expect(rulesBody.ruleNames).toContain(customName);

    const platformId = rulesBody.rules.find((r) => r.id !== custom.ruleId)?.id;
    expect(platformId).toBeTruthy();

    const blocked = await request.post("/api/test/methodology/prepare", {
      data: {
        action: "try-delete-advisor-rec-rule",
        advisorEmail,
        ruleId: platformId,
      },
    });
    const blockedBody = (await blocked.json()) as { deleted: boolean; error?: string };
    expect(blockedBody.deleted).toBe(false);
    expect(blockedBody.error).toMatch(/cannot be deleted/i);
  });

  test("deactivated platform recommendation rule is excluded from new snapshot", async ({
    request,
  }) => {
    const clientEmail = "client-fresh@test.com";
    const advisorEmail = "advisor@test.com";

    await request.post("/api/test/methodology/prepare", {
      data: { action: "reset-intake", clientEmail },
    });

    await request.post("/api/test/methodology/prepare", {
      data: { action: "start-intake-snapshot", clientEmail },
    });
    const peek = await request.post("/api/test/methodology/prepare", {
      data: { action: "get-snapshot-rec-rules", clientEmail },
    });
    const peekBody = (await peek.json()) as { rules: { id: string; serviceId: string }[] };
    const target = peekBody.rules[0];
    expect(target).toBeTruthy();

    await request.post("/api/test/methodology/prepare", {
      data: { action: "reset-intake", clientEmail },
    });

    await request.post("/api/test/methodology/prepare", {
      data: {
        action: "deactivate-advisor-rec-rule",
        advisorEmail,
        ruleId: target.id,
      },
    });

    await request.post("/api/test/methodology/prepare", {
      data: { action: "start-intake-snapshot", clientEmail },
    });
    const after = await request.post("/api/test/methodology/prepare", {
      data: { action: "get-snapshot-rec-rules", clientEmail },
    });
    const afterBody = (await after.json()) as { rules: { id: string }[] };
    expect(afterBody.rules.find((r) => r.id === target.id)).toBeUndefined();
  });
});
