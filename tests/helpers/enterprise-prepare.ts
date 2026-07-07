import { expect, type APIRequestContext } from "@playwright/test";

import type {
  EnterpriseScenarioInspect,
  EnterpriseScenarioSnapshot,
} from "@/lib/test/enterprise-e2e";

export async function setupEnterpriseScenario(
  request: APIRequestContext,
  body: { ownerEmail: string; memberEmail: string; runId?: string },
): Promise<EnterpriseScenarioSnapshot> {
  const res = await request.post("/api/test/enterprise/prepare", {
    data: { action: "setup", ...body },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json() as Promise<EnterpriseScenarioSnapshot>;
}

export async function inspectEnterpriseScenario(
  request: APIRequestContext,
  body: { enterpriseId: string; memberEmail: string },
): Promise<EnterpriseScenarioInspect> {
  const res = await request.post("/api/test/enterprise/prepare", {
    data: { action: "inspect", ...body },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json() as Promise<EnterpriseScenarioInspect>;
}

export async function teardownEnterpriseScenario(
  request: APIRequestContext,
  body: { enterpriseId: string; slug: string; actorEmail: string },
): Promise<void> {
  const res = await request.post("/api/test/enterprise/prepare", {
    data: { action: "teardown", ...body },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}
