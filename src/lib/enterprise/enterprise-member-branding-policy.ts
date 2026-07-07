import "server-only";

import { prisma } from "@/lib/db";

import {
  DEFAULT_ENTERPRISE_MEMBER_BRANDING_POLICY,
  mapEnterpriseMemberBrandingPolicy,
  type EnterpriseMemberBrandingPolicy,
} from "./enterprise-member-branding-policy-tier";

const enterpriseBrandingPolicySelect = {
  advisorMemberPersonalBrandingEnabled: true,
  advisorMemberSubdomainEditable: true,
} as const;

export async function getEnterpriseMemberBrandingPolicyForEnterprise(
  enterpriseId: string,
): Promise<EnterpriseMemberBrandingPolicy> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: enterpriseBrandingPolicySelect,
  });
  if (!enterprise) {
    return DEFAULT_ENTERPRISE_MEMBER_BRANDING_POLICY;
  }
  return mapEnterpriseMemberBrandingPolicy(enterprise);
}
