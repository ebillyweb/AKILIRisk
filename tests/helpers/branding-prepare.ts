import { expect, type APIRequestContext } from "@playwright/test";

import type { BrandingE2EBaseline } from "@/lib/test/branding-e2e";

export interface BrandingPrepareResult {
  advisorEmail: string;
  advisorId: string;
  advisorUserId: string;
  baseline: BrandingE2EBaseline;
  restored?: boolean;
}

export async function prepareAdvisorBranding(
  request: APIRequestContext,
  body: {
    advisorEmail: string;
    ensureBrandingEnabled?: boolean;
    restore?: BrandingE2EBaseline;
  }
): Promise<BrandingPrepareResult> {
  const res = await request.post("/api/test/branding/prepare", { data: body });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json() as Promise<BrandingPrepareResult>;
}
