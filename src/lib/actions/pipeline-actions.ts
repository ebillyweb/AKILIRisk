'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { UserRole } from '@prisma/client';
import { requireAdvisorRole, getAdvisorProfileOrThrow } from '@/lib/advisor/auth';
import { getClientPipeline, getPipelineMetrics, getClientDetail } from '@/lib/pipeline/queries';
import { prisma } from '@/lib/db';
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit/audit-log';

export async function getClientPipelineData() {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);

    const clients = await getClientPipeline(profile.id);
    const metrics = getPipelineMetrics(clients);

    return {
      success: true,
      data: { clients, metrics, profile },
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

    // Verify advisor owns the client assignment
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        advisorId: profile.id,
        clientId,
        status: 'ACTIVE',
      },
    });

    if (!assignment) {
      return {
        success: false,
        error: 'Client not found or not assigned to you',
      };
    }

    // Create document requirement
    const requirement = await prisma.documentRequirement.create({
      data: {
        advisorId: profile.id,
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
      metadata: { clientId, advisorId: profile.id },
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
    const requirement = await prisma.documentRequirement.findFirst({
      where: {
        id: requirementId,
        advisorId: profile.id,
      },
    });

    if (!requirement) {
      return {
        success: false,
        error: 'Document requirement not found or not owned by you',
      };
    }

    // Delete the requirement
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
    const profile = await getAdvisorProfileOrThrow(userId);

    const clientDetail = await getClientDetail(profile.id, clientId);

    return {
      success: true,
      data: clientDetail,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get client detail data';
    return { success: false, error: message };
  }
}