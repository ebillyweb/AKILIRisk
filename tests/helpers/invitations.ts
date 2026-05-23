import { expect, type APIRequestContext } from "@playwright/test";

export type TestInvitationIssueResult = {
  invitationId: string;
  url: string;
  clientEmail: string;
  status: string;
  intakeWaived: boolean;
};

export type IssueTestInvitationOptions = {
  advisorEmail?: string;
  clientEmail: string;
  clientName?: string;
  intakeWaived?: boolean;
};

/**
 * Creates an advisor invitation via POST /api/test/invitation/issue.
 */
export async function issueTestInvitation(
  request: APIRequestContext,
  options: IssueTestInvitationOptions
): Promise<TestInvitationIssueResult> {
  const res = await request.post("/api/test/invitation/issue", {
    data: {
      advisorEmail: options.advisorEmail ?? "advisor@test.com",
      clientEmail: options.clientEmail,
      clientName: options.clientName,
      intakeWaived: options.intakeWaived ?? false,
    },
  });

  expect(res.ok(), `invitation issue failed: ${res.status()} ${await res.text()}`).toBe(
    true
  );

  const body = (await res.json()) as TestInvitationIssueResult;
  expect(body.url).toContain("invite=");
  return body;
}

/** Unique client email for isolated invitation E2E runs. */
export function uniqueInvitationEmail(label: string): string {
  const slug = label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `e2e-invite-${slug}-${Date.now()}@akili-e2e.test`;
}

/** Navigate using Playwright baseURL (strip origin from stored invitation URLs). */
export function invitationPathFromUrl(fullUrl: string): string {
  const u = new URL(fullUrl);
  return u.pathname + u.search;
}
