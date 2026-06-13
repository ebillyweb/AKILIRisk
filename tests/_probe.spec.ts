import { test } from "@playwright/test";

test("debug advisor sign-in", async ({ page, request }) => {
  // Reset+enroll MFA for advisor
  const prep = await request.post("/api/test/mfa/prepare", { data: { email: "advisor@test.com", resetOnly: false } });
  console.log("[prep status]", prep.status());
  const p = await prep.json();
  console.log("[prep keys]", Object.keys(p));

  await page.goto("/signin");
  console.log("[url after goto]", page.url());
  const email = page.locator("#email");
  await email.fill("advisor@test.com");
  await page.locator("#password").fill("testpassword123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForTimeout(5000);
  console.log("[url after click]", page.url());
  const errors = await page.locator("[role=alert], [class*=destructive]").allTextContents();
  console.log("[errors]", JSON.stringify(errors.filter(t => t.trim())));
});
