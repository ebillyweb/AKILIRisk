import type { APIRequestContext } from "@playwright/test";

export type PreparedAssessment = {
  userId: string;
  clientId: string;
  assessmentId: string;
  status: string;
  draftReportId: string | null;
  pillarsScored: string[];
};

/**
 * Score all six pillars via POST /api/test/assessment/prepare (ENABLE_TEST_AUTH=1).
 */
export async function prepareCompletedAssessment(
  request: APIRequestContext,
  options: {
    clientEmail: string;
    reset?: boolean;
    maturityAnswer?: number;
  }
): Promise<PreparedAssessment> {
  const res = await request.post("/api/test/assessment/prepare", {
    data: {
      clientEmail: options.clientEmail,
      reset: options.reset ?? true,
      maturityAnswer: options.maturityAnswer,
    },
  });

  if (res.status() === 404) {
    throw new Error(
      "Test assessment prepare endpoint returned 404. Set ENABLE_TEST_AUTH=1 on the target deployment."
    );
  }

  if (!res.ok()) {
    throw new Error(
      `Test assessment prepare failed: ${res.status()} ${await res.text()}`
    );
  }

  return (await res.json()) as PreparedAssessment;
}
