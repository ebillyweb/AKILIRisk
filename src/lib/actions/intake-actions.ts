'use server';

import { auth } from '@/lib/auth';
import {
  createIntakeInterview,
  getIntakeInterview,
  getActiveIntakeInterview,
  getLatestIntakeInterview,
  saveIntakeResponse,
  updateInterviewProgress,
  submitIntakeInterview,
  getIntakeResponsesByInterview,
} from '@/lib/data/intake';
import { saveResponseSchema, submitInterviewSchema } from '@/lib/schemas/intake';
import { revalidatePath } from 'next/cache';
import type { IntakeQuestion } from '@/lib/intake/types';
import { loadIntakeScriptQuestions } from '@/lib/intake/load-intake-script';
import { personalizeIntakeScript } from '@/lib/intake/personalize-intake-question';
import { getAssignedAdvisorFirmNameForClient } from '@/lib/client/assigned-advisor-firm-name';
import { prisma } from '@/lib/db';
import { notifyAdvisorsOfIntake } from '@/lib/intake/notify-advisor';
import { syncInvitationStatusForClientEmail } from '@/lib/invitations/redeem-invitation';
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit/audit-log';
import { requireClientUserRole } from '@/lib/client/require-client-role';
import type { UserRole } from '@prisma/client';

// Helper function to get authenticated client user ID
async function getAuthUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }
  requireClientUserRole(session.user.role);
  return session.user.id;
}

/** Audit-friendly actor info — same shape as profile-actions.ts. */
async function getAuthActor() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }
  requireClientUserRole(session.user.role);
  return {
    userId: session.user.id,
    role: session.user.role as UserRole | undefined,
    email: session.user.email ?? null,
  };
}

// Start or resume an active intake interview
export async function startIntakeInterview() {
  try {
    const userId = await getAuthUserId();

    const submittedInterview = await prisma.intakeInterview.findFirst({
      where: {
        userId,
        OR: [{ status: "SUBMITTED" }, { submittedAt: { not: null } }],
      },
      orderBy: { submittedAt: "desc" },
    });
    if (submittedInterview) {
      return { success: true, interview: submittedInterview };
    }

    // Check if there's an active interview
    let interview = await getActiveIntakeInterview(userId);

    if (!interview) {
      // Create a new interview
      interview = await createIntakeInterview(userId);
    }

    return { success: true, interview };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start intake interview';
    return { success: false, error: message };
  }
}

// Save response for a specific question
export async function saveResponse(interviewId: string, data: unknown) {
  try {
    const userId = await getAuthUserId();

    const validatedFields = saveResponseSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    // Verify interview ownership
    const interview = await getIntakeInterview(userId, interviewId);
    if (!interview) {
      return { success: false, error: 'Interview not found' };
    }

    const response = await saveIntakeResponse(
      interviewId,
      validatedFields.data.questionId,
      {
        audioUrl: validatedFields.data.audioUrl,
        audioDuration: validatedFields.data.audioDuration,
        transcription: validatedFields.data.transcription,
        skipped: validatedFields.data.skipped,
      }
    );

    revalidatePath(`/intake/${interviewId}`);
    return { success: true, response };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save response';
    return { success: false, error: message };
  }
}

// Update interview progress
export async function updateProgress(interviewId: string, questionIndex: number) {
  try {
    const userId = await getAuthUserId();

    // Verify interview ownership
    const interview = await getIntakeInterview(userId, interviewId);
    if (!interview) {
      return { success: false, error: 'Interview not found' };
    }

    // Determine status based on progress
    let status = interview.status;
    if (status === 'NOT_STARTED') {
      status = 'IN_PROGRESS';
    }
    const script = await loadIntakeScriptQuestions();
    if (script.length > 0 && questionIndex >= script.length - 1) {
      status = 'COMPLETED';
    }

    const updatedInterview = await updateInterviewProgress(interviewId, questionIndex, status);

    revalidatePath(`/intake/${interviewId}`);
    return { success: true, interview: updatedInterview };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update progress';
    return { success: false, error: message };
  }
}

// Submit completed interview
export async function submitIntakeInterviewAction(interviewId: string) {
  try {
    const actor = await getAuthActor();
    const userId = actor.userId;

    const validatedFields = submitInterviewSchema.safeParse({ interviewId });
    if (!validatedFields.success) {
      return {
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    // Verify interview ownership
    const interview = await getIntakeInterview(userId, interviewId);
    if (!interview) {
      return { success: false, error: 'Interview not found' };
    }

    const script = await loadIntakeScriptQuestions();
    const expectedIds = script.map((q) => q.id);
    const responses = await getIntakeResponsesByInterview(interviewId);
    const byQuestionId = new Map(responses.map((r) => [r.questionId, r]));
    const missing = expectedIds.filter((id) => {
      const r = byQuestionId.get(id);
      return !(r?.audioUrl || r?.transcription?.trim());
    });

    if (missing.length > 0) {
      return {
        success: false,
        error: `Interview incomplete: ${expectedIds.length - missing.length}/${expectedIds.length} questions have a recorded or typed answer`,
      };
    }

    const submittedInterview = await submitIntakeInterview(interviewId);
    if (!submittedInterview) {
      return { success: false, error: 'Failed to submit interview' };
    }

    await writeAudit({
      actor,
      action: AUDIT_ACTIONS.INTAKE_SUBMIT,
      entityType: 'IntakeInterview',
      entityId: interviewId,
      beforeData: { status: interview.status },
      afterData: {
        status: submittedInterview.status,
        submittedAt: submittedInterview.submittedAt?.toISOString() ?? null,
      },
      metadata: {
        responseCount: responses.length,
        questionCount: expectedIds.length,
      },
    });

    // Fire-and-forget advisor notification. Previously this round-tripped
    // through `fetch /api/intake/[id]/notify-advisor`, which (a) couldn't
    // forward the user's session cookie from a server-action context so
    // the route always 401'd, and (b) used a `process.env.NEXTAUTH_URL ||
    // 'http://localhost:3000'` fallback that hit localhost from the
    // deployed function. Calling the helper directly skips both problems
    // and inherits its in-process error handling.
    void notifyAdvisorsOfIntake(interviewId).catch((error) => {
      console.error('Advisor notification failed:', error);
    });

    if (actor.email) {
      const assignments = await prisma.clientAdvisorAssignment.findMany({
        where: { clientId: userId, status: "ACTIVE" },
        select: { advisorId: true },
      });
      for (const assignment of assignments) {
        void syncInvitationStatusForClientEmail(
          actor.email,
          assignment.advisorId,
        ).catch((error) => {
          console.error("Invitation status sync failed:", error);
        });
      }
    }

    revalidatePath(`/intake/${interviewId}`);
    return { success: true, interview: submittedInterview };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit interview';
    return { success: false, error: message };
  }
}

// Get interview with responses for current user
export async function getIntakeInterviewAction(interviewId: string) {
  try {
    const userId = await getAuthUserId();
    const interview = await getIntakeInterview(userId, interviewId);

    if (!interview) {
      return { success: false, error: 'Interview not found' };
    }

    return { success: true, interview };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get interview';
    return { success: false, error: message, interview: null };
  }
}

// Get active interview for current user
export async function getActiveIntakeInterviewAction() {
  try {
    const userId = await getAuthUserId();
    const interview = await getActiveIntakeInterview(userId);

    return { success: true, interview };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get active interview';
    return { success: false, error: message, interview: null };
  }
}

export async function getLatestIntakeInterviewAction() {
  try {
    const userId = await getAuthUserId();
    const interview = await getLatestIntakeInterview(userId);
    return { success: true as const, interview };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get latest interview';
    return { success: false as const, error: message, interview: null };
  }
}

/** Ordered script for the audio intake interview (pillar `INTAKE` category or legacy fallback). */
export async function getIntakeScriptQuestionsAction() {
  try {
    const userId = await getAuthUserId();
    const [questions, firmName] = await Promise.all([
      loadIntakeScriptQuestions(),
      getAssignedAdvisorFirmNameForClient(userId),
    ]);
    return {
      success: true as const,
      questions: personalizeIntakeScript(questions, firmName),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load intake questions';
    return { success: false as const, error: message, questions: [] as IntakeQuestion[] };
  }
}