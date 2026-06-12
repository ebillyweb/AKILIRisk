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
  });

  // ──────────────────────────────────────────────────────────────────
  // Surfaced bugs — see tests/INVENTORY.md "Surfaced bugs".
  // ──────────────────────────────────────────────────────────────────

  test.fixme(
    "PREVIEW: /api/assessment/enhanced returns no recommendations until publish",
    async ({ page, request }) => {
      // Prepare a fully-scored client in PREVIEW phase. The expected
      // behaviour once fixed: the enhanced-results endpoint suppresses
      // `recommendations[]` and `actionPlan[]` until a PUBLISHED Report
      // exists for the assessment (or deliverablePhase >= PROFILE).
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
      const body = (await r.json()) as {
        recommendations: unknown[];
        actionPlan: unknown[];
      };
      expect(body.recommendations).toEqual([]);
      expect(body.actionPlan).toEqual([]);
    }
  );

  test.fixme(
    "dashboard does NOT contradict itself when intake is un-approved but assessment is COMPLETED",
    async ({ page, request }) => {
      // Set the client to the rare regressed state: scored assessment +
      // intake no longer approved. Today the hero shows
      //   INTAKE: In review  /  ASSESSMENT: Complete  /  OVERALL: 1.9/10
      // while the body card shows
      //   "Assessment unlocks after your advisor reviews..."
      // and there is no heat map / phase banner. Both blocks should
      // agree on whether the assessment is usable.
      await request.post("/api/test/assessment/prepare", {
        data: { clientEmail: "client@test.com", reset: true, complete: true },
      });

      await new SignInPage(page).signInAs("client");
      await page.goto("/dashboard");
      const main = await page.locator("main").innerText();

      const heroAssessment = /ASSESSMENT\s+Complete/i.test(main);
      const heroIntakeReview = /INTAKE\s+In review/i.test(main);
      const bodyLocked = /Assessment unlocks after your advisor reviews/i.test(
        main
      );

      if (heroAssessment && heroIntakeReview) {
        // If the hero shows "complete + in review", the body must NOT also
        // tell the user to wait for advisor approval. Either show the
        // heat-map / phase banner, or show a single unified "regressed
        // approval" notice instead of contradicting the hero.
        expect(bodyLocked).toBe(false);
      }
    }
  );
});
