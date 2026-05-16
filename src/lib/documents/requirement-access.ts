import "server-only";

import type { DocumentRequirement } from "@prisma/client";

import { prisma } from "@/lib/db";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";

/**
 * Resolves access to a document requirement for presigned upload/download flows.
 * Clients may access their own rows; advisors (and admins with an advisor profile) may access rows for their firm.
 */
export async function getDocumentRequirementForSessionUser(
  userId: string,
  role: string | undefined,
  requirementId: string
): Promise<DocumentRequirement | null> {
  const requirement = await prisma.documentRequirement.findUnique({
    where: { id: requirementId },
  });

  if (!requirement) {
    return null;
  }

  const roleUpper = (role ?? "USER").toString().toUpperCase();

  if (roleUpper === "USER") {
    if (requirement.clientId !== userId) {
      return null;
    }
    return requirement;
  }

  if (isAdvisorHubNavRole(roleUpper)) {
    const profile = await prisma.advisorProfile.findUnique({
      where: { userId },
    });
    if (!profile || profile.id !== requirement.advisorId) {
      return null;
    }
    return requirement;
  }

  return null;
}

/** Ensures the S3 key was issued for this client + requirement (prevents cross-tenant confirm abuse). */
export function keyMatchesDocumentRequirement(
  key: string,
  clientUserId: string,
  requirementId: string
): boolean {
  const prefix = `documents/${clientUserId}/${requirementId}/`;
  return key.startsWith(prefix) && key.length > prefix.length;
}
