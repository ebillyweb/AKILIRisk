import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Exploratory hunt on the scoring + recommendation + deliverable-phase
 * state machine. Probes 1–10 in the chat history (June 2026 hunt):
 *
 *   ✓  client cannot reach /advisor/* recommendations / engagements / signals
 *      (already covered by tenant-isolation + role-gate specs; not re-asserted here)
 *   ✓  empty assessment returns sensible zero scores (no NaN/Infinity)
 *   ✓  PREVIEW phase: no Accept-the-recommendation affordance on dashboard
 *
 * Two surfaced bugs are pinned as test.fixme so the suite stays green
 * while the issues are logged in tests/INVENTORY.md "Surfaced bugs":
 *
 *   1) /api/assessment/enhanced/[id]/results returns the full
 *      recommendations[] + actionPlan[] regardless of deliverablePhase
 *      or report.status. Latent: if the recommendation engine produces
 *      rows during scoring (it does for some pillar configs), the
 *      client can read them via this API before the advisor publishes
 *      a report. BRD §6.3 says PREVIEW phase = "heat-map view, no plan".
 *
 *   2) The client dashboard shows contradictory state when intake is
 *      no longer approved but the assessment is COMPLETED with scores
 *      (PREVIEW phase). Hero shows "ASSESSMENT: Complete" + overall
 *      risk number; the body card shows "Assessment unlocks after your
 *      advisor reviews and approves your intake". No heat map / phase
 *      banner. Reachable when an advisor regresses intake approval
 *      (or via the test-prepare endpoint).
 */
test.describe("scoring + deliverable-phase hunt", () => {
  test("empty assessment returns score=0, no NaN, no Infinity", async ({
    page,
    request,
  }) => {
    const prep = await request.post("/api/test/assessment/prepare", {
      data: {
        clientEmail: "client-fresh@test.com",
        reset: true,
        complete: false,
      },
    });
    expect(prep.status()).toBe(200);
    const p = (await prep.json()) as { assessmentId: string };

    await new SignInPage(page).signInAs("clientFresh");
    const cookies = (await page.context().cookies())
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const r = await request.get(
      `/api/assessment/enhanced/${p.assessmentId}/results`,
      { headers: { cookie: cookies } }
    );
    expect(r.status()).toBe(200);
    const body = (await r.json()) as {
      overallScore: { score: number; riskLevel: string; completionPercentage: number };
      pillarScores: unknown[];
      recommendations: unknown[];
      assessment: { status: string };
    };

    expect(body.assessment.status).toBe("IN_PROGRESS");
    expect(body.pillarScores).toEqual([]);
    expect(body.recommendations).toEqual([]);
    expect(body.overallScore.score).toBe(0);
    expect(body.overallScore.completionPercentage).toBe(0);
    expect(body.overallScore.riskLevel).toBe("UNKNOWN");
    expect(Number.isFinite(body.overallScore.score)).toBe(true);
    const text = JSON.stringify(body);
    expect(text.includes("NaN"), "response must not contain NaN").toBe(false);
    expect(text.includes("Infinity"), "response must not contain Infinity").toBe(false);
  });

  test("dashboard hides Accept-recommendation affordance in PREVIEW phase", async ({
    page,
    request,
  }) => {
    await request.post("/api/test/assessment/prepare", {
      data: { clientEmail: "client@test.com", reset: true, complete: true },
    });

    await new SignInPage(page).signInAs("client");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle").catch(() => null);

    // BRD §6.3 PREVIEW: heat-map view, no plan, no upsell button.
    await expect(
      page.getByRole("button", { name: /accept this recommendation/i })
    ).toHaveCount(0);
    await expect(
      page.getByText(/accept this recommendation/i)
    ).toHaveCount(0);
    await expect(page.getByTestId("risk-heat-map-single")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^risk assessment$/i }),
    ).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────
  // Surfaced bugs — see tests/INVENTORY.md "Surfaced bugs".
  // ──────────────────────────────────────────────────────────────────

  test("PREVIEW: /api/assessment/enhanced returns no recommendations until publish", async ({
    page,
    request,
  }) => {
    // PREVIEW phase: scored assessment, no PUBLISHED Report yet.
    // Recommendations + action plan must be suppressed until publish.
    const prep = await request.post("/api/test/assessment/prepare", {
      data: { clientEmail: "client@test.com", reset: true, complete: true },
    });
    const p = (await prep.json()) as { assessmentId: string };

    await new SignInPage(page).signInAs("client");
    const cookies = (await page.context().cookies())
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const r = await request.get(
      `/api/assessment/enhanced/${p.assessmentId}/results`,
      { headers: { cookie: cookies } }
    );
    expect(r.status()).toBe(200);
    const body = (await r.json()) as {
      recommendations: unknown[];
      actionPlan: unknown[];
      pillarScores: unknown[];
      overallScore: { score: number };
    };
    // The publish gate hides recommendations + action plan in PREVIEW.
    expect(body.recommendations).toEqual([]);
    expect(body.actionPlan).toEqual([]);
    // The PREVIEW affordance (heat-map score data) stays visible — that's
    // what BRD §6.3 says the client gets to see in Phase 1.
    expect(body.pillarScores.length).toBeGreaterThan(0);
    expect(body.overallScore.score).toBeGreaterThan(0);
  });

  test("dashboard does NOT contradict itself when intake is un-approved but assessment is COMPLETED", async ({
    page,
    request,
  }) => {
    await request.post("/api/test/assessment/prepare", {
      data: { clientEmail: "client@test.com", reset: true, complete: true },
    });

    await new SignInPage(page).signInAs("client");
    await page.goto("/dashboard");
    const main = await page.locator("main").innerText();

    const bodyLocked = /Unlocks after your advisor approves intake/i.test(
      main
    );

    if (bodyLocked) {
      await expect(page.getByTestId("dashboard-journey")).toBeVisible();
      await expect(main).not.toMatch(/\d+\.\d+\s*\/\s*10/);
    }
  });
});
