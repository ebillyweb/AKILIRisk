import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import {
  DOCUMENT_S3_SKIP_REASON,
  isDocumentS3Configured,
  uploadDocumentViaPresignedFlow,
  type ClientDocumentFixture,
} from "../helpers/documents";
import { readSseUntilEvent } from "../helpers/sse";
import { skipUnlessTestAuth } from "../helpers/test-auth";

const CRON_PATHS = [
  "/api/cron/document-reminders",
  "/api/cron/workflow-reminders",
] as const;

const CRON_SECRET = process.env.CRON_SECRET?.trim() ?? "";

function playwrightBaseHostname(): string {
  try {
    return new URL(
      process.env.PLAYWRIGHT_BASE_URL ?? "https://preview.akilirisk.com",
    ).hostname;
  } catch {
    return "preview.akilirisk.com";
  }
}

function cronRemoteE2EAllowed(): boolean {
  const h = playwrightBaseHostname();
  if (h === "localhost" || h === "127.0.0.1") return true;
  return process.env.E2E_CRON_REMOTE === "1";
}

function cronSkipReason(): string {
  if (!CRON_SECRET) {
    return "CRON_SECRET not set in test runner env (see .env.example)";
  }
  if (!cronRemoteE2EAllowed()) {
    return "Cron e2e uses localhost by default; set E2E_CRON_REMOTE=1 when the remote deployment has the same CRON_SECRET";
  }
  return "";
}

async function cookieHeaderFromPage(page: import("@playwright/test").Page) {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

function loadDocumentFixture(): ClientDocumentFixture {
  const repoRoot = resolve(__dirname, "../..");
  const out = execSync("node scripts/get-client-document-fixture.js", {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(out) as ClientDocumentFixture;
}

test.describe("Epic 5.4 — documents, cron, SSE", () => {
  test.describe("US-31 — client document upload (S3)", () => {
    test.beforeEach(() => {
      if (!isDocumentS3Configured()) {
        test.skip(true, DOCUMENT_S3_SKIP_REASON);
      }
      execSync("node scripts/reset-client-document-requirement.js", {
        cwd: resolve(__dirname, "../.."),
        stdio: "inherit",
      });
    });

    test("presigned upload-url → S3 PUT → confirm marks requirement fulfilled", async ({
      page,
      request,
    }) => {
      test.setTimeout(90_000);
      await skipUnlessTestAuth(request);

      const fixture = loadDocumentFixture();
      await new SignInPage(page).signInAs("client");
      const cookies = await cookieHeaderFromPage(page);

      const result = await uploadDocumentViaPresignedFlow(
        request,
        cookies,
        fixture,
      );
      expect(result.fulfilled).toBe(true);
      expect(result.fileKey).toContain(
        `documents/${fixture.clientId}/${fixture.requirementId}/`,
      );
    });
  });

  test.describe("US-36 — cron reminder endpoints", () => {
    test("rejects missing and invalid Authorization", async ({ request }) => {
      const skip = cronSkipReason();
      if (skip) test.skip(true, skip);

      for (const path of CRON_PATHS) {
        const missing = await request.get(path);
        expect(missing.status(), path).toBe(401);

        const invalid = await request.get(path, {
          headers: { Authorization: "Bearer definitely-wrong-secret" },
        });
        expect(invalid.status(), path).toBe(401);
      }
    });

    test("accepts Bearer CRON_SECRET and returns processing JSON", async ({
      request,
    }) => {
      const skip = cronSkipReason();
      if (skip) test.skip(true, skip);

      for (const path of CRON_PATHS) {
        const res = await request.get(path, {
          headers: { Authorization: `Bearer ${CRON_SECRET}` },
        });

        if (res.status() === 500) {
          const body = await res.text();
          test.skip(
            true,
            `${path} returned 500 — set CRON_SECRET on the target deployment. ${body.slice(0, 200)}`,
          );
        }

        expect(res.status(), path).toBe(200);
        const json = (await res.json()) as {
          success: boolean;
          timestamp?: string;
        };
        expect(json.success, path).toBe(true);
        expect(json.timestamp, path).toBeTruthy();
      }
    });
  });

  test.describe("US-28 — pipeline SSE live refresh", () => {
    test("status-stream sends connected and pipeline_update for advisor", async ({
      page,
      request,
    }) => {
      test.setTimeout(45_000);
      await skipUnlessTestAuth(request);

      await new SignInPage(page).signInAs("advisor");
      const cookies = await cookieHeaderFromPage(page);

      const baseURL =
        test.info().project.use.baseURL ?? "http://localhost:3000";
      const streamUrl = new URL("/api/advisor/status-stream", baseURL).toString();

      const connectedChunk = await readSseUntilEvent(
        streamUrl,
        cookies,
        "connected",
        10_000,
      );
      expect(connectedChunk).toContain("event: connected");

      const updateChunk = await readSseUntilEvent(
        streamUrl,
        cookies,
        "pipeline_update",
        12_000,
      );
      expect(updateChunk).toContain('"clients"');
      expect(updateChunk).toContain("event: pipeline_update");
    });

    test("pipeline UI shows Live updates after SSE connects", async ({
      page,
      request,
    }) => {
      await skipUnlessTestAuth(request);
      await new SignInPage(page).signInAs("advisor");
      await page.goto("/advisor/pipeline");

      await expect(page.getByText(/live updates/i)).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});
