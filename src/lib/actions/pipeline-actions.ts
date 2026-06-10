'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { UserRole } from '@prisma/client';
import { requireAdvisorRole, getAdvisorProfileOrThrow } from '@/lib/advisor/auth';
import {
  countInactiveClientAssignmentsForAdvisorUser,
  getClientDetailForAdvisorUser,
  getClientPipelineForAdvisorUser,
  getPipelineMetrics,
} from '@/lib/pipeline/queries';
import { findPortfolioAssignmentForClient, listAdvisorProfileIdsForScope, resolvePortfolioScope } from '@/lib/enterprise/portfolio-access';
import { prisma } from '@/lib/db';
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit/audit-log';

export async function getClientPipelineData(options?: { inactive?: boolean }) {
  try {
    const { userId } = await requireAdvisorRole();

    const showInactive = options?.inactive === true;
    const [clients, inactiveCount] = await Promise.all([
      getClientPipelineForAdvisorUser(userId, {
        assignmentStatus: showInactive ? 'INACTIVE' : 'ACTIVE',
      }),
      countInactiveClientAssignmentsForAdvisorUser(userId),
    ]);
    const metrics = { ...getPipelineMetrics(clients), inactive: inactiveCount };

    return {
      success: true,
      data: { clients, metrics, profile: await getAdvisorProfileOrThrow(userId) },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get client pipeline data';
    return { success: false, error: message };
  }
}

const documentRequirementSchema = z.object({
  clientId: z.string().cuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  required: z.boolean().optional().default(true),
});

export async function addDocumentRequirement(data: unknown) {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const validatedFields = documentRequirementSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { clientId, name, description, required } = validatedFields.data;

    const scope = await resolvePortfolioScope(userId);
    if (!scope) {
      return { success: false, error: 'Client not found or not assigned to you' };
    }
    const access = await findPortfolioAssignmentForClient(scope, clientId);
    if (!access) {
      return {
        success: false,
        error: 'Client not found or not assigned to you',
      };
    }

    const requirement = await prisma.documentRequirement.create({
      data: {
        advisorId: access.assignmentAdvisorProfileId,
        clientId,
        name,
        description,
        required: required ?? true,
        fulfilled: false,
      },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.DOCUMENT_REQUIREMENT_CREATE,
      entityType: 'DocumentRequirement',
      entityId: requirement.id,
      beforeData: null,
      afterData: {
        name: requirement.name,
        description: requirement.description,
        fulfilled: requirement.fulfilled,
      },
      metadata: { clientId, advisorId: access.assignmentAdvisorProfileId },
    });

    revalidatePath('/advisor/pipeline');
    return {
      success: true,
      data: requirement,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add document requirement';
    return { success: false, error: message };
  }
}

export async function removeDocumentRequirement(requirementId: string) {
  try {
    const { userId, role, email } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const validatedFields = z.object({
      requirementId: z.string().cuid(),
    }).safeParse({ requirementId });

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Invalid requirement ID',
      };
    }

    // Verify advisor owns the requirement
    const scope = await resolvePortfolioScope(userId);
    if (!scope) {
      return { success: false, error: 'Document requirement not found or not owned by you' };
    }

    const advisorProfileIds = await listAdvisorProfileIdsForScope(scope);

    const requirement = await prisma.documentRequirement.findFirst({
      where: {
        id: requirementId,
        advisorId: { in: advisorProfileIds },
      },
    });

    if (!requirement) {
      return {
        success: false,
        error: 'Document requirement not found or not owned by you',
      };
    }

    const clientAccess = await findPortfolioAssignmentForClient(scope, requirement.clientId);
    if (!clientAccess) {
      return {
        success: false,
        error: 'Document requirement not found or not owned by you',
      };
    }

    await prisma.documentRequirement.delete({
      where: { id: requirementId },
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email },
      action: AUDIT_ACTIONS.DOCUMENT_REQUIREMENT_DELETE,
      entityType: 'DocumentRequirement',
      entityId: requirement.id,
      beforeData: {
        name: requirement.name,
        description: requirement.description,
        fulfilled: requirement.fulfilled,
        clientId: requirement.clientId,
      },
      afterData: null,
      metadata: { advisorId: profile.id },
    });

    revalidatePath('/advisor/pipeline');
    return {
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove document requirement';
    return { success: false, error: message };
  }
}

export async function getClientDetailData(clientId: string) {
  try {
    const { userId } = await requireAdvisorRole();

    const clientDetail = await getClientDetailForAdvisorUser(userId, clientId);

    return {
      success: true,
      data: clientDetail,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get client detail data';
    return { success: false, error: message };
  }
}