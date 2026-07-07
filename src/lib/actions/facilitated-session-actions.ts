"use server";

import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdvisorRole, getAdvisorProfileOrThrow, advisorHubActionErrorMessage } from "@/lib/advisor/auth";
import { assertCanAddClientForAdvisorProfile } from "@/lib/billing/subscription-service";
import {
  createIntakeInterview,
  getActiveIntakeInterview,
} from "@/lib/data/intake";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import {
  assertAdvisorPortfolioAccessToClient,
  getFacilitatedSessionForAdvisor,
} from "@/lib/facilitated/session-access";
import {
  findResumableFacilitatedSession,
  listOpenFacilitatedSessionsForAdvisor,
} from "@/lib/facilitated/queries";
import { mergeFacilitatedLauncherClients, type FacilitatedLauncherClient } from "@/lib/facilitated/launcher-clients";
import { mapPipelineClientToLauncherClient } from "@/lib/facilitated/launcher-display";
import { provisionFacilitatedClient } from "@/lib/facilitated/provision-facilitated-client";
import {
  createFacilitatedClientSchema,
  startFacilitatedSessionSchema,
} from "@/lib/schemas/facilitated";
import { facilitatedAssessmentHubPath } from "@/lib/facilitated/paths";
import {
  facilitatedSessionStepPath,
  type FacilitatedSessionSummary,
} from "@/lib/facilitated/types";
import { getClientPipelineForAdvisorUser } from "@/lib/pipeline/queries";
import type { PipelineClient } from "@/lib/pipeline/types";
import { resolveAdvisorClientPipelineLabels } from "@/lib/pipeline/client-display";
import { loadAdvisorPiiPolicy, resolveAdvisorClientIdentity } from "@/lib/advisor/field-visibility";
import { resolveClientReferenceCode } from "@/lib/client/client-reference-code.server";
import { tryBootstrapFacilitatedFromExistingApproval } from "@/lib/facilitated/bootstrap-assessment-from-approval";

export type FacilitatedLauncherData = {
  clients: FacilitatedLauncherClient[];
  openSessions: FacilitatedSessionSummary[];
};

async function resolveSessionClientDisplay(
  session: FacilitatedSessionSummary,
  pipelineById: Map<string, PipelineClient>,
  advisorProfileId: string,
): Promise<Pick<FacilitatedSessionSummary, "clientDisplayName" | "clientDisplayPseudonymous">> {
  const pipelineClient = pipelineById.get(session.clientId);
  if (pipelineClient) {
    const labels = resolveAdvisorClientPipelineLabels(pipelineClient);
    return {
      clientDisplayName: labels.headline,
      clientDisplayPseudonymous: labels.pseudonymous,
    };
  }

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      clientId: session.clientId,
      advisorId: advisorProfileId,
      status: "ACTIVE",
    },
    select: {
      fieldVisibility: true,
      client: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          emailCiphertext: true,
          clientReferenceCode: true,
        },
      },
    },
  });

  if (!assignment) {
    return {
      clientDisplayName: "Client",
      clientDisplayPseudonymous: true,
    };
  }

  const advisorPolicy = await loadAdvisorPiiPolicy(advisorProfileId);
  const identity = resolveAdvisorClientIdentity(
    assignment.client,
    assignment.fieldVisibility,
    advisorPolicy,
  );
  const clientReferenceCode = await resolveClientReferenceCode(
    assignment.client.id,
    assignment.client.clientReferenceCode,
  );
  const labels = resolveAdvisorClientPipelineLabels({
    id: assignment.client.id,
    name: identity.name,
    firstName: assignment.client.firstName,
    lastName: assignment.client.lastName,
    email: identity.email,
    clientReferenceCode,
    pseudonymousWorkspaceLabeling: advisorPolicy.pseudonymousWorkspaceLabeling,
  });

  return {
    clientDisplayName: labels.headline,
    clientDisplayPseudonymous: labels.pseudonymous,
  };
}

export async function getFacilitatedLauncherData(): Promise<FacilitatedLauncherData> {
  const { userId } = await requireAdvisorRole();
  const profile = await getAdvisorProfileOrThrow(userId);
  const [pipeline, openSessions] = await Promise.all([
    getClientPipelineForAdvisorUser(userId, { assignmentStatus: "ACTIVE" }),
    listOpenFacilitatedSessionsForAdvisor(profile.id),
  ]);

  const pipelineById = new Map(pipeline.map((client) => [client.id, client]));
  const launcherClients = pipeline.map(mapPipelineClientToLauncherClient);
  const openSessionsWithDisplay = await Promise.all(
    openSessions.map(async (session) => {
      const display = await resolveSessionClientDisplay(
        session,
        pipelineById,
        profile.id,
      );
      return { ...session, ...display };
    }),
  );

  return {
    clients: mergeFacilitatedLauncherClients(launcherClients, openSessionsWithDisplay),
    openSessions: openSessionsWithDisplay,
  };
}

async function ensureClientIntakeInterview(clientId: string): Promise<string> {
  const existing = await getActiveIntakeInterview(clientId);
  if (existing) return existing.id;
  const created = await createIntakeInterview(clientId);
  return created.id;
}

async function createFacilitatedSessionRow(input: {
  clientId: string;
  advisorProfileId: string;
  actor: { userId: string; role: UserRole | undefined; email: string | null };
  resume: boolean;
}) {
  if (input.resume) {
    const existing = await findResumableFacilitatedSession({
      clientId: input.clientId,
      advisorProfileId: input.advisorProfileId,
    });
    if (existing) {
      await writeAudit({
        actor: input.actor,
        action: AUDIT_ACTIONS.FACILITATED_SESSION_RESUME,
        entityType: "FacilitatedSession",
        entityId: existing.id,
        metadata: {
          clientId: input.clientId,
          facilitatedSessionId: existing.id,
          advisorProfileId: input.advisorProfileId,
        },
      });
      return existing;
    }
  }

  const interviewId = await ensureClientIntakeInterview(input.clientId);
  const session = await prisma.facilitatedSession.create({
    data: {
      clientId: input.clientId,
      advisorProfileId: input.advisorProfileId,
      interviewId,
      status: "INTAKE",
    },
    include: {
      client: { select: { name: true, emailCiphertext: true } },
    },
  });

  await writeAudit({
    actor: input.actor,
    action: AUDIT_ACTIONS.FACILITATED_SESSION_START,
    entityType: "FacilitatedSession",
    entityId: session.id,
    afterData: { status: session.status, interviewId },
    metadata: {
      clientId: input.clientId,
      facilitatedSessionId: session.id,
      advisorProfileId: input.advisorProfileId,
    },
  });

  return {
    id: session.id,
    clientId: session.clientId,
    advisorProfileId: session.advisorProfileId,
    status: session.status,
    interviewId: session.interviewId,
    assessmentId: session.assessmentId,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    clientName: session.client.name,
    clientEmail: null,
    progressDetail: null,
    clientDisplayName: "Client",
    clientDisplayPseudonymous: true,
  } satisfies FacilitatedSessionSummary;
}

export async function startFacilitatedSessionForClient(data: unknown) {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const parsed = startFacilitatedSessionSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    await assertAdvisorPortfolioAccessToClient(userId, parsed.data.clientId);
    const session = await createFacilitatedSessionRow({
      clientId: parsed.data.clientId,
      advisorProfileId: profile.id,
      actor: { userId, role: role as UserRole, email: email ?? null },
      resume: parsed.data.resumeExisting !== false,
    });

    const bootstrapPath = await tryBootstrapFacilitatedFromExistingApproval(
      session.id,
      parsed.data.clientId,
    );

    const stepPath = facilitatedSessionStepPath(session.id, session.status);
    const redirectTo =
      bootstrapPath ??
      (session.status === "ASSESSMENT"
        ? facilitatedAssessmentHubPath(session.id, { resume: true })
        : stepPath);

    revalidatePath("/advisor/facilitate");
    return {
      success: true as const,
      sessionId: session.id,
      redirectTo,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to start session",
    };
  }
}

export async function createClientAndStartFacilitatedSession(data: unknown) {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const parsed = createFacilitatedClientSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    await assertCanAddClientForAdvisorProfile(profile.id);
    const provision = await provisionFacilitatedClient({
      email: parsed.data.clientEmail,
      name: parsed.data.clientName,
      advisorProfileId: profile.id,
    });
    if (!provision.ok) {
      return { success: false as const, error: provision.error };
    }

    const session = await createFacilitatedSessionRow({
      clientId: provision.userId,
      advisorProfileId: profile.id,
      actor: { userId, role: role as UserRole, email: email ?? null },
      resume: false,
    });

    revalidatePath("/advisor/facilitate");
    revalidatePath("/advisor/pipeline");
    return {
      success: true as const,
      sessionId: session.id,
      redirectTo: facilitatedSessionStepPath(session.id, session.status),
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to create client",
    };
  }
}

export async function getFacilitatedSessionRedirect(sessionId: string) {
  const { userId } = await requireAdvisorRole();
  const session = await getFacilitatedSessionForAdvisor(sessionId, userId);
  if (!session) {
    return { success: false as const, error: "Session not found" };
  }
  return {
    success: true as const,
    redirectTo: facilitatedSessionStepPath(session.id, session.status),
    status: session.status,
    clientName: session.client.name,
  };
}

export async function finishFacilitatedSession(sessionId: string) {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const session = await getFacilitatedSessionForAdvisor(sessionId, userId);
    if (!session) {
      return { success: false as const, error: "Session not found" };
    }
    if (session.status !== "PREVIEW") {
      return {
        success: false as const,
        error: "Complete the assessment preview before finishing the session.",
      };
    }

    const updated = await prisma.facilitatedSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETE", completedAt: new Date() },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email: email ?? null },
      action: AUDIT_ACTIONS.FACILITATED_SESSION_COMPLETE,
      entityType: "FacilitatedSession",
      entityId: sessionId,
      beforeData: { status: session.status },
      afterData: { status: updated.status, completedAt: updated.completedAt?.toISOString() },
      metadata: {
        clientId: session.clientId,
        facilitatedSessionId: sessionId,
        assessmentId: session.assessmentId,
      },
    });

    revalidatePath("/advisor/pipeline");
    revalidatePath("/advisor/facilitate");
    return { success: true as const, redirectTo: `/advisor/pipeline/${session.clientId}` };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to finish session",
    };
  }
}
