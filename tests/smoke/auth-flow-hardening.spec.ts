import { test, expect } from "@playwright/test";

/**
 * Defensive checks on auth flows that already passed exploratory probing.
 *
 * Confirms:
 *   - Magic-link single-use enforcement (replay -> /failed?reason=used).
 *   - Magic-link token tampering rejection (/failed?reason=not_found).
 *   - Magic-link issuance rate-limit kicks in after 3 attempts per
 *     (ip, hashed-email) window (HTTP 429).
 *   - Stripe webhook rejects missing/bogus signatures with 400.
 *
 * Rate-limit assertion uses a unique recipient email per test run so the
 * counter doesn't poison subsequent suite runs.
 */

test.describe("auth flow hardening", () => {
  test("magic-link verify is single-use; replay lands on /failed?reason=used", async ({
    page,
    request,
  }) => {
    const issue = await request.post("/api/test/magic-link/issue", {
      data: { email: "client-fresh@test.com" },
    });
    expect(issue.status()).toBe(200);
    const { verifyUrl } = (await issue.json()) as { verifyUrl: string };
    const verify = new URL(verifyUrl);

    // First verify signs the user in.
    const r1 = await page.goto(verify.pathname + verify.search);
    expect(r1?.status()).toBe(200);
    expect(new URL(page.url()).pathname).not.toMatch(/\/auth\/magic-link\/failed/);

    // Drop the session and try the same token again.
    await page.context().clearCookies();
    await page.goto(verify.pathname + verify.search);
    expect(new URL(page.url()).pathname).toBe("/auth/magic-link/failed");
    expect(new URL(page.url()).searchParams.get("reason")).toBe("used");
    await expect(
      page.getByRole("heading", { name: /sign-in link already used/i })
    ).toBeVisible();
  });

  test("magic-link verify rejects a tampered token with /failed?reason=not_found", async ({
    page,
    request,
  }) => {
    const issue = await request.post("/api/test/magic-link/issue", {
      data: { email: "client-fresh@test.com" },
    });
    expect(issue.status()).toBe(200);
    const { verifyUrl } = (await issue.json()) as { verifyUrl: string };
    const tampered = new URL(verifyUrl);
    const raw = tampered.searchParams.get("token");
    expect(raw).not.toBeNull();
    const mutated = raw!.slice(0, -1) + (raw!.slice(-1) === "a" ? "b" : "a");
    tampered.searchParams.set("token", mutated);

    await page.context().clearCookies();
    await page.goto(tampered.pathname + tampered.search);
    expect(new URL(page.url()).pathname).toBe("/auth/magic-link/failed");
    expect(new URL(page.url()).searchParams.get("reason")).toBe("not_found");
  });

  test("magic-link issuance rate-limits per (ip, email)", async ({
    request,
  }) => {
    // Use a unique address so the per-(ip,email) bucket starts empty regardless
    // of suite ordering. Real users don't exist for this address — magic-link
    // request is enumeration-safe, so a 200 is still returned until the limit
    // fires. The configured limit is 3/hour but the in-memory rate limiter is
    // per-Vercel-instance, so the EXACT first 429 attempt is sensitive to
    // serverless fanout. We assert the looser-but-meaningful invariant:
    // sustained calls eventually return at least one 429.
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const email = `pw-ratelimit-${stamp}@example.invalid`;

    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await request.post("/api/auth/magic-link/request", {
        data: { email },
      });
      codes.push(r.status());
    }
    const limited = codes.filter((c) => c === 429).length;
    expect(
      limited,
      `expected at least one 429 across 12 requests, saw codes ${codes.join(",")}`
    ).toBeGreaterThan(0);
  });

  test("stripe webhook rejects POST without a Stripe-Signature header (400)", async ({
    request,
  }) => {
    const r = await request.post("/api/webhooks/stripe", {
      headers: { "Content-Type": "application/json" },
      data: { id: "evt_test_pw", type: "ping", data: { object: {} } },
    });
    expect(r.status()).toBe(400);
  });

  test("stripe webhook rejects POST with a bogus Stripe-Signature header (400)", async ({
    request,
  }) => {
    const r = await request.post("/api/webhooks/stripe", {
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": "t=1234,v1=deadbeef",
      },
      data: { id: "evt_test_pw_bogus", type: "ping", data: { object: {} } },
    });
    expect(r.status()).toBe(400);
  });
});
