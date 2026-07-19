"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { isPlatformAdminRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/db";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import {
  executeAssessmentRescore,
  type RescoreActionResult,
  type RescoreAssessmentResult,
} from "@/lib/assessment/execute-assessment-rescore";

const advisorRescoreSchema = z.object({
  assessmentId: z.string().cuid(),
});

export type AdvisorRescoreActionResult = RescoreActionResult<RescoreAssessmentResult>;

export async function advisorRescoreAssessment(
  input: z.infer<typeof advisorRescoreSchema>,
): Promise<AdvisorRescoreActionResult> {
  try {
    const { userId, role } = await requireAdvisorRole();
    const { assessmentId } = advisorRescoreSchema.parse(input);

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { userId: true },
    });
    if (!assessment) {
      return { success: false, error: "Assessment not found" };
    }

    // Platform staff may re-score any client from the advisor hub; assigned
    // advisors still require an ACTIVE assignment (matches report actions).
    if (!isPlatformAdminRole(role)) {
      const profile = await getAdvisorProfileOrThrow(userId);
      const assignment = await prisma.clientAdvisorAssignment.findFirst({
        where: {
          advisorId: profile.id,
          clientId: assessment.userId,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!assignment) {
        return { success: false, error: "You do not have access to this client" };
      }
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailCiphertext: true, role: true },
    });
    if (!actor) {
      return { success: false, error: "Unauthorized" };
    }

    const { safeDecryptUserEmail } = await import("@/lib/auth/user-email");
    const result = await executeAssessmentRescore({
      assessmentId,
      actor: {
        userId,
        email: safeDecryptUserEmail(actor.emailCiphertext, { rowId: userId }),
        role: actor.role,
      },
    });

    if (result.success) {
      revalidatePath("/advisor/pipeline");
      revalidatePath(`/advisor/pipeline/${assessment.userId}`);
      revalidatePath("/advisor/reassessment");
    }

    return result;
  } catch (err) {
    logSafeError("advisorRescoreAssessment", err);
    return { success: false, error: safeErrorMessage(err, "Re-score failed") };
  }
}
