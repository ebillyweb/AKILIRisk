import "server-only";

import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { requireSuperAdminRole } from "@/lib/admin/auth";

export type ClientAssignmentTargetGroup = {
  label: string;
  options: { value: string; label: string }[];
};

const TARGET_PREFIX = {
  advisor: "advisor:",
  enterprise: "enterprise:",
} as const;

export function encodeAdvisorAssignmentTarget(advisorProfileId: string): string {
  return `${TARGET_PREFIX.advisor}${advisorProfileId}`;
}

export function encodeEnterpriseAssignmentTarget(enterpriseId: string): string {
  return `${TARGET_PREFIX.enterprise}${enterpriseId}`;
}

/**
 * Assignment targets for super-admin client assignment UI.
 * Values are `advisor:{profileId}` or `enterprise:{enterpriseId}` (resolves to firm owner).
 */
export async function getClientAssignmentTargetsForAdmin(): Promise<
  ClientAssignmentTargetGroup[]
> {
  await requireSuperAdminRole();

  const [enterprises, soloAdvisors, enterpriseAdvisors] = await Promise.all([
    prisma.advisorEnterprise.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        memberships: {
          where: { role: "OWNER", status: "ACTIVE" },
          take: 1,
          select: {
            advisorProfileId: true,
            user: { select: { name: true, emailCiphertext: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.advisorProfile.findMany({
      where: {
        enterpriseId: null,
        user: { deletedAt: null, role: "ADVISOR" },
      },
      select: {
        id: true,
        firmName: true,
        user: { select: { name: true, emailCiphertext: true } },
      },
      orderBy: [{ firmName: "asc" }, { id: "asc" }],
    }),
    prisma.advisorProfile.findMany({
      where: {
        enterpriseId: { not: null },
        user: { deletedAt: null, role: "ADVISOR" },
      },
      select: {
        id: true,
        firmName: true,
        enterprise: { select: { name: true } },
        user: { select: { name: true, emailCiphertext: true } },
      },
      orderBy: [{ enterprise: { name: "asc" } }, { id: "asc" }],
    }),
  ]);

  const groups: ClientAssignmentTargetGroup[] = [];

  const enterpriseOptions = enterprises
    .map((enterprise) => {
      const owner = enterprise.memberships[0];
      if (!owner?.advisorProfileId) return null;
      const ownerEmail = decryptUserEmail(owner.user.emailCiphertext);
      const ownerLabel = owner.user.name?.trim() || ownerEmail;
      return {
        value: encodeEnterpriseAssignmentTarget(enterprise.id),
        label: `${enterprise.name} (owner: ${ownerLabel})`,
      };
    })
    .filter((row): row is { value: string; label: string } => row !== null);

  if (enterpriseOptions.length > 0) {
    groups.push({ label: "Enterprises", options: enterpriseOptions });
  }

  const soloOptions = soloAdvisors.map((profile) => {
    const email = decryptUserEmail(profile.user.emailCiphertext);
    const firm = profile.firmName?.trim() || "Independent";
    const name = profile.user.name?.trim() || email;
    return {
      value: encodeAdvisorAssignmentTarget(profile.id),
      label: `${name} · ${firm}`,
    };
  });

  if (soloOptions.length > 0) {
    groups.push({ label: "Independent advisors", options: soloOptions });
  }

  const teamOptions = enterpriseAdvisors.map((profile) => {
    const email = decryptUserEmail(profile.user.emailCiphertext);
    const firm =
      profile.enterprise?.name?.trim() ||
      profile.firmName?.trim() ||
      "Enterprise";
    const name = profile.user.name?.trim() || email;
    return {
      value: encodeAdvisorAssignmentTarget(profile.id),
      label: `${name} · ${firm}`,
    };
  });

  if (teamOptions.length > 0) {
    groups.push({ label: "Enterprise advisors", options: teamOptions });
  }

  return groups;
}
