import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { parseAssignmentFieldVisibility } from "@/lib/advisor/field-visibility";
import {
  parsePiiPolicy,
  type EligiblePiiField,
  type PiiPolicy,
} from "@/lib/advisor/pii-policy";

export interface ClientConsentPreferenceAssignment {
  assignmentId: string;
  firmName: string | null;
  advisorPolicy: PiiPolicy;
  /** Current Yes/No map — only fields the advisor collects are shown. */
  currentDecisions: Partial<Record<EligiblePiiField, boolean>>;
}

/** Assignments where the client has already recorded consent and may
 *  revisit preferences from /settings. */
export async function listClientConsentPreferences(
  clientUserId: string
): Promise<ClientConsentPreferenceAssignment[]> {
  const rows = await prisma.clientAdvisorAssignment.findMany({
    where: {
      clientId: clientUserId,
      status: "ACTIVE",
      fieldVisibility: { not: Prisma.DbNull },
    },
    orderBy: { assignedAt: "asc" },
    select: {
      id: true,
      fieldVisibility: true,
      advisor: { select: { firmName: true, piiPolicy: true } },
    },
  });

  return rows.map((row) => {
    const advisorPolicy = parsePiiPolicy(row.advisor.piiPolicy);
    const visibility = parseAssignmentFieldVisibility(row.fieldVisibility);
    const currentDecisions: Partial<Record<EligiblePiiField, boolean>> = {};
    for (const [field, enabled] of Object.entries(advisorPolicy.fields)) {
      if (!enabled) continue;
      currentDecisions[field as EligiblePiiField] =
        visibility[field as EligiblePiiField];
    }
    return {
      assignmentId: row.id,
      firmName: row.advisor.firmName,
      advisorPolicy,
      currentDecisions,
    };
  });
}
