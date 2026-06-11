"use server";

import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import {
  getIntakeInterview,
  getIntakeResponsesByInterview,
  saveIntakeResponse,
  submitIntakeInterview,
  updateInterviewProgress,
} from "@/lib/data/intake";
import { loadIntakeScriptQuestions } from "@/lib/intake/load-intake-script";
import { prisma } from "@/lib/db";
import { saveResponseSchema } from "@/lib/schemas/intake";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { requireFacilitatedSessionForAdvisor } from "@/lib/facilitated/session-access";

async function getFacilitatorActor() {
  const session = await auth();
  if (!session?.user?.id || !isAdvisorHubNavRole(session.user.role)) {
    throw new Error("Not authorized");
  }
  return {
    userId: session.user.id,
    role: session.user.role as UserRole,
    email: session.user.email ?? null,
  };
}

export async function facilitatedSaveIntakeResponse(
  facilitatedSessionId: string,
  data: unknown,
) {
  try {
    const actor = await getFacilitatorActor();
    const facilitated = await requireFacilitatedSessionForAdvisor(
      facilitatedSessionId,
    );
    if (facilitated.status !== "INTAKE" || !facilitated.interviewId) {
      return { success: false as const, error: "Intake is not active for this session" };
    }

    const parsed = saveResponseSchema.safeParse({
      ...(typeof data === "object" && data !== null ? data : {}),
      interviewId: facilitated.interviewId,
    });
    if (!parsed.success) {
      return { success: false as const, errors: parsed.error.flatten().fieldErrors };
    }

    const interview = await getIntakeInterview(
      facilitated.clientId,
      facilitated.interviewId,
    );
    if (!interview) {
      return { success: false as const, error: "Interview not found" };
    }

    const response = await saveIntakeResponse(
      facilitated.interviewId,
      parsed.data.questionId,
      {
        audioUrl: parsed.data.audioUrl,
        audioDuration: parsed.data.audioDuration,
        transcription: parsed.data.transcription,
      },
    );

    return { success: true as const, response };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to save response",
    };
  }
}

export async function facilitatedUpdateIntakeProgress(
  facilitatedSessionId: string,
  questionIndex: number,
) {
  try {
    await getFacilitatorActor();
    const facilitated = await requireFacilitatedSessionForAdvisor(
      facilitatedSessionId,
    );
    if (!facilitated.interviewId) {
      return { success: false as const, error: "Interview not found" };
    }

    const interview = await getIntakeInterview(
      facilitated.clientId,
      facilitated.interviewId,
    );
    if (!interview) {
      return { success: false as const, error: "Interview not found" };
    }

    let status = interview.status;
    if (status === "NOT_STARTED") status = "IN_PROGRESS";
    const script = await loadIntakeScriptQuestions();
    if (script.length > 0 && questionIndex >= script.length - 1) {
      status = "COMPLETED";
    }

    const updated = await updateInterviewProgress(
      facilitated.interviewId,
      questionIndex,
      status,
    );
    return { success: true as const, interview: updated };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to update progress",
    };
  }
}

export async function facilitatedSubmitIntake(facilitatedSessionId: string) {
  try {
    const actor = await getFacilitatorActor();
    const facilitated = await requireFacilitatedSessionForAdvisor(
      facilitatedSessionId,
    );
    if (!facilitated.interviewId) {
      return { success: false as const, error: "Interview not found" };
    }

    const interview = await getIntakeInterview(
      facilitated.clientId,
      facilitated.interviewId,
    );
    if (!interview) {
      return { success: false as const, error: "Interview not found" };
    }

    const script = await loadIntakeScriptQuestions();
    const expectedIds = script.map((q) => q.id);
    const responses = await getIntakeResponsesByInterview(facilitated.interviewId);
    const byQuestionId = new Map(responses.map((r) => [r.questionId, r]));
    const missing = expectedIds.filter((id) => {
      const r = byQuestionId.get(id);
      return !(r?.audioUrl || r?.transcription?.trim());
    });
    if (missing.length > 0) {
      return {
        success: false as const,
        error: `Interview incomplete: ${expectedIds.length - missing.length}/${expectedIds.length} questions answered`,
      };
    }

    const submitted = await submitIntakeInterview(facilitated.interviewId);
    if (!submitted) {
      return { success: false as const, error: "Failed to submit interview" };
    }

    await prisma.facilitatedSession.update({
      where: { id: facilitatedSessionId },
      data: { status: "PILLAR_SELECT" },
    });

    await writeAudit({
      actor,
      action: AUDIT_ACTIONS.FACILITATED_SESSION_INTAKE_SUBMIT,
      entityType: "FacilitatedSession",
      entityId: facilitatedSessionId,
      beforeData: { status: facilitated.status },
      afterData: { status: "PILLAR_SELECT", interviewStatus: submitted.status },
      metadata: {
        clientId: facilitated.clientId,
        facilitatedSessionId,
        interviewId: facilitated.interviewId,
      },
    });

    revalidatePath(`/advisor/facilitate/${facilitatedSessionId}/intake`);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to submit intake",
    };
  }
}

export async function facilitatedGetIntakeInterview(facilitatedSessionId: string) {
  try {
    await getFacilitatorActor();
    const facilitated = await requireFacilitatedSessionForAdvisor(
      facilitatedSessionId,
    );
    if (!facilitated.interviewId) {
      return { success: false as const, error: "Interview not found", interview: null };
    }
    const interview = await getIntakeInterview(
      facilitated.clientId,
      facilitated.interviewId,
    );
    if (!interview) {
      return { success: false as const, error: "Interview not found", interview: null };
    }
    return { success: true as const, interview };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to load interview",
      interview: null,
    };
  }
}
