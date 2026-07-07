import "server-only";

import { parsePiiPolicy } from "@/lib/advisor/pii-policy";
import { resolveClientReferenceCode } from "@/lib/client/client-reference-code.server";
import { resolveClientPortalSignedInLabel } from "@/lib/client/client-portal-identity";
import { resolveEffectivePolicyForAdvisorProfile } from "@/lib/enterprise/enterprise-client-data-policy";
import { prisma } from "@/lib/db";

/** Client portal header identity: email by default, Client CL-… when labeling is on. */
export async function getClientPortalSignedInLabel(input: {
  clientUserId: string;
  clientEmail: string;
}): Promise<string> {
  const [assignment, user] = await Promise.all([
    prisma.clientAdvisorAssignment.findFirst({
      where: { clientId: input.clientUserId, status: "ACTIVE" },
      orderBy: { assignedAt: "desc" },
      select: {
        advisor: { select: { id: true, piiPolicy: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: input.clientUserId },
      select: { clientReferenceCode: true },
    }),
  ]);

  let pseudonymousWorkspaceLabeling = false;
  if (assignment?.advisor) {
    const advisorPolicy = parsePiiPolicy(assignment.advisor.piiPolicy);
    const effective = await resolveEffectivePolicyForAdvisorProfile(
      assignment.advisor.id,
      advisorPolicy,
    );
    pseudonymousWorkspaceLabeling = effective.pseudonymousWorkspaceLabeling;
  }

  let clientReferenceCode = user?.clientReferenceCode ?? null;
  if (pseudonymousWorkspaceLabeling && !clientReferenceCode?.trim()) {
    clientReferenceCode = await resolveClientReferenceCode(input.clientUserId, null);
  }

  return resolveClientPortalSignedInLabel({
    clientEmail: input.clientEmail,
    pseudonymousWorkspaceLabeling,
    clientReferenceCode,
  });
}
