import type { APIRequestContext } from "@playwright/test";

export type PreparedHouseholdProfiles = {
  clientUserId: string;
  advisorProfileId: string;
  householdProfilesEnabled: boolean;
  memberCount: number;
};

/**
 * Reset household members and optionally set advisor policy via
 * POST /api/test/household-profiles/prepare (ENABLE_TEST_AUTH=1).
 */
export async function prepareHouseholdProfiles(
  request: APIRequestContext,
  options: {
    clientEmail: string;
    advisorEmail?: string;
    resetMembers?: boolean;
    householdProfilesEnabled?: boolean;
  },
): Promise<PreparedHouseholdProfiles> {
  const res = await request.post("/api/test/household-profiles/prepare", {
    data: options,
  });

  if (res.status() === 404) {
    throw new Error(
      "Test household-profiles prepare endpoint returned 404. Set ENABLE_TEST_AUTH=1 on the target deployment.",
    );
  }

  if (!res.ok()) {
    throw new Error(
      `Test household-profiles prepare failed: ${res.status()} ${await res.text()}`,
    );
  }

  return (await res.json()) as PreparedHouseholdProfiles;
}
