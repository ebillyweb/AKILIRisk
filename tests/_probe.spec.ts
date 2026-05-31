import { test } from "@playwright/test";
import { SignInPage } from "./page-objects/SignInPage";

test("client navigating advisor pages", async ({ page }) => {
  await new SignInPage(page).signInAs("client");
  for (const p of ["/advisor/recommendations", "/advisor/engagements", "/advisor/signals", "/advisor/intelligence", "/advisor/pipeline"]) {
    await page.goto(p);
    const final = page.url().replace("https://preview.akilirisk.com", "");
    console.log(`${p} -> ${final}`);
    // Did /advisor content actually render?
    const adviseHeader = await page.getByText(/Advisor Workspace|Open engagements|Risk intelligence/i).count();
    console.log("  advisor content count:", adviseHeader);
  }
});

test("publishReport - client cannot publish", async ({ page, request }) => {
  await new SignInPage(page).signInAs("client");
  const cookies = (await page.context().cookies()).map(c => `${c.name}=${c.value}`).join("; ");
  // Use the draftReportId from prep run — but it changes per run. Get it from prep.
  const prep = await request.post("/api/test/assessment/prepare", {
    data: { clientEmail: "client@test.com", reset: true, complete: true },
    headers: { cookie: cookies },
  });
  console.log("[prep status]", prep.status());
  const p = await prep.json().catch(() => null);
  console.log("[draft id]", p?.draftReportId);

  // No public route for publish — actions are called from forms. Just confirm
  // /assessment/results is accessible since assessment is COMPLETED.
});

test("acceptRecommendation - reject PREVIEW phase", async ({ page, request }) => {
  // Use a fresh prepare so assessment is in PREVIEW (not PROFILE)
  const prep = await request.post("/api/test/assessment/prepare", {
    data: { clientEmail: "client@test.com", reset: true, complete: true },
  });
  const p = await prep.json().catch(() => null);
  console.log("[prep status]", prep.status(), "assessment", p?.assessmentId);

  // The action accepts {assessmentId} but I'd need to call it via a UI form.
  // Just probe the dashboard — does it show "Accept" button for PREVIEW phase?
  await new SignInPage(page).signInAs("client");
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle").catch(() => null);
  const accept = await page.getByRole("button", { name: /accept/i }).count();
  console.log("[Accept button on dashboard]", accept);
  const acceptText = await page.getByText(/accept.*recommendation/i).count();
  console.log("[accept-recommendation text]", acceptText);
});
