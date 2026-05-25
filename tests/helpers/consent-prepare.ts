import { expect, type APIRequestContext, type Page } from "@playwright/test";

type ConsentField =
  | "User.name"
  | "ClientProfile.phone"
  | "HouseholdMember.fullName"
  | "HouseholdMember.phone"
  | "HouseholdMember.notes";

export async function prepareClientConsent(
  request: APIRequestContext,
  body:
    | { clientEmail: string; resetPending: true }
    | { clientEmail: string; restoreConsented: true }
    | {
        clientEmail: string;
        setFieldVisibility: Partial<Record<ConsentField, boolean>>;
      }
) {
  const res = await request.post("/api/test/consent/prepare", { data: body });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

export async function prepareAdvisorPiiPolicy(
  request: APIRequestContext,
  body:
    | { advisorEmail: string; restoreDefault: true }
    | {
        advisorEmail: string;
        fields: Partial<Record<ConsentField, boolean>>;
      }
) {
  const res = await request.post("/api/test/pii-policy/prepare", { data: body });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

/** Establish a client session via the test magic-link helper. */
export async function signInClientViaMagicLink(
  page: Page,
  request: APIRequestContext,
  email: string
) {
  const issueRes = await request.post("/api/test/magic-link/issue", {
    data: { email },
  });
  expect(issueRes.ok()).toBeTruthy();
  const { verifyUrl } = (await issueRes.json()) as { verifyUrl: string };
  const u = new URL(verifyUrl);
  await page.goto(u.pathname + u.search);
}
