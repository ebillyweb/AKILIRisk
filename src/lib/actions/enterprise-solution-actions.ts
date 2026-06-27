"use server";

/**
 * Enterprise overlay CRUD server actions.
 *
 * All actions require advisor role + enterprise team manager auth.
 * Overlay writes are validated against the override policy to prevent
 * PROTECTED field mutations (T-22-06 mitigation).
 */

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdvisorRole, advisorHubActionErrorMessage } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { validateOverlayFields } from "@/lib/recommendations/override-policy";
import {
  enterpriseOverlaySchema,
  type EnterpriseOverlayInput,
} from "./guidance-schemas";

// ── Result types ─────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function fail(error: string): ActionResult<never> {
  return { success: false, error };
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

function revalidate() {
  revalidatePath("/advisor/enterprise/guidance");
}

// ── Enterprise overlay actions ───────────────────────────────────────────

/**
 * Create or update an enterprise overlay on a platform service recommendation.
 *
 * Enforces override policy: rejects writes to PROTECTED fields (Pitfall 5).
 * Scopes all queries to team.enterpriseId for data isolation (T-22-06).
 */
export async function upsertEnterpriseOverlay(
  input: EnterpriseOverlayInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    const parsed = enterpriseOverlaySchema.parse(input);

    // Extract field names being written (non-undefined keys minus serviceRecommendationId)
    const fieldNames = Object.entries(parsed)
      .filter(([key, val]) => key !== "serviceRecommendationId" && val !== undefined)
      .map(([key]) => key);

    // Validate against override policy
    const { rejected } = validateOverlayFields(fieldNames);
    if (rejected.length > 0) {
      return fail(
        `Cannot modify protected fields: ${rejected.join(", ")}. These fields are controlled by the platform.`
      );
    }

    // Build upsert data (only write non-undefined fields)
    const writeData: Record<string, unknown> = {};
    if (parsed.isRequired !== undefined) writeData.isRequired = parsed.isRequired;
    if (parsed.priorityAdjustment !== undefined) writeData.priorityAdjustment = parsed.priorityAdjustment;
    if (parsed.complianceDisclosures !== undefined) writeData.complianceDisclosures = parsed.complianceDisclosures;
    if (parsed.customGuidance !== undefined) writeData.customGuidance = parsed.customGuidance;
    if (parsed.internalLinks !== undefined) writeData.internalLinks = parsed.internalLinks as unknown as Prisma.InputJsonValue;
    if (parsed.costOverride !== undefined) writeData.costOverride = parsed.costOverride;
    if (parsed.timeframeOverride !== undefined) writeData.timeframeOverride = parsed.timeframeOverride;
    if (parsed.providerOverride !== undefined) writeData.providerOverride = parsed.providerOverride;
    if (parsed.notes !== undefined) writeData.notes = parsed.notes;
    if (parsed.additionalPlaybook !== undefined) writeData.additionalPlaybook = parsed.additionalPlaybook as unknown as Prisma.InputJsonValue;
    if (parsed.isActive !== undefined) writeData.isActive = parsed.isActive;

    const result = await prisma.enterpriseSolutionCustomization.upsert({
      where: {
        enterpriseId_serviceRecommendationId: {
          enterpriseId: team.enterpriseId,
          serviceRecommendationId: parsed.serviceRecommendationId,
        },
      },
      create: {
        enterpriseId: team.enterpriseId,
        serviceRecommendationId: parsed.serviceRecommendationId,
        ...writeData,
      } as never,
      update: writeData as never,
    });

    revalidate();
    return ok({ id: result.id });
  } catch (error) {
    return fail(
      advisorHubActionErrorMessage(error, "Failed to save enterprise overlay")
    );
  }
}

/**
 * Get all enterprise overlays, optionally filtered by service recommendation.
 * Scoped to the authenticated enterprise (T-22-06).
 */
export async function getEnterpriseOverlays(
  filters?: { serviceRecommendationId?: string }
): Promise<ActionResult<{ overlays: Array<Record<string, unknown>> }>> {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const where: Prisma.EnterpriseSolutionCustomizationWhereInput = {
      enterpriseId: team.enterpriseId,
    };
    if (filters?.serviceRecommendationId) {
      where.serviceRecommendationId = filters.serviceRecommendationId;
    }

    const overlays = await prisma.enterpriseSolutionCustomization.findMany({
      where,
      include: {
        serviceRecommendation: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            priority: true,
            tier: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    revalidate();
    return ok({ overlays: overlays as unknown as Array<Record<string, unknown>> });
  } catch (error) {
    return fail(
      advisorHubActionErrorMessage(error, "Failed to load enterprise overlays")
    );
  }
}
