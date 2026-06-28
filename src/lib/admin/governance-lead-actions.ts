"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin/auth";
import { createNotification } from "@/lib/data/advisor";
import { formatInvestableAssetsRange } from "@/lib/governance/investable-assets-range";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

const assignLeadSchema = z.object({
  leadId: z.string().cuid(),
  advisorProfileId: z.union([z.literal(""), z.string().cuid()]).optional(),
});

export async function assignGovernanceReviewLeadAction(raw: unknown) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
    const parsed = assignLeadSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid assignment payload" };
    }

    const rawAdvisor = parsed.data.advisorProfileId ?? "";
    const advisorProfileId =
      rawAdvisor === "" ? null : rawAdvisor;

    if (advisorProfileId) {
      const advisor = await prisma.advisorProfile.findUnique({
        where: { id: advisorProfileId },
        select: { id: true },
      });
      if (!advisor) {
        return { success: false as const, error: "Advisor not found" };
      }
    }

    const lead = await prisma.governanceReviewLead.findUnique({
      where: { id: parsed.data.leadId },
    });
    if (!lead) {
      return { success: false as const, error: "Lead not found" };
    }

    await prisma.governanceReviewLead.update({
      where: { id: lead.id },
      data: {
        assignedAdvisorId: advisorProfileId,
        assignedAt: advisorProfileId ? new Date() : null,
      },
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.GOVERNANCE_LEAD_ASSIGN,
      entityType: "GovernanceReviewLead",
      entityId: lead.id,
      beforeData: {
        assignedAdvisorId: lead.assignedAdvisorId,
        assignedAt: lead.assignedAt?.toISOString() ?? null,
      },
      afterData: {
        assignedAdvisorId: advisorProfileId,
        assignedAt: advisorProfileId ? new Date().toISOString() : null,
      },
    });

    if (advisorProfileId) {
      const assetsLine = lead.investableAssetsRange
        ? ` Assets: ${formatInvestableAssetsRange(lead.investableAssetsRange)}.`
        : "";
      await createNotification(
        advisorProfileId,
        "NEW_LEAD",
        "Assessment lead assigned to you",
        `${lead.name} (${lead.email}). Complexity: ${lead.familyComplexity.replace(/_/g, " ").toLowerCase()}.${assetsLine}`,
        lead.id
      );
    }

    revalidatePath("/admin/leads");
    return { success: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update assignment";
    return { success: false as const, error: message };
  }
}
