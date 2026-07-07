import "server-only";

import type { EnterpriseRole } from "@prisma/client";

import {
  parsePiiPolicy,
  type EligiblePiiField,
  type PiiPolicy,
} from "@/lib/advisor/pii-policy";
import { prisma } from "@/lib/db";

import { resolveBillingContext } from "./billing-context";

export type EnterpriseClientDataPolicy = {
  pseudonymousLabelingDefault: boolean;
  collectClientLegalNameDefault: boolean;
  policyLocked: boolean;
};

export type EffectiveAdvisorClientDataPolicy = {
  pseudonymousWorkspaceLabeling: boolean;
  fields: PiiPolicy["fields"];
  lockedByEnterprise: boolean;
};

const enterpriseClientDataPolicySelect = {
  advisorMemberPseudonymousLabelingDefault: true,
  advisorMemberCollectClientLegalNameDefault: true,
  advisorMemberClientDataPolicyLocked: true,
} as const;

export const DEFAULT_ENTERPRISE_CLIENT_DATA_POLICY: EnterpriseClientDataPolicy =
  {
    pseudonymousLabelingDefault: false,
    collectClientLegalNameDefault: true,
    policyLocked: false,
  };

export function mapEnterpriseClientDataPolicy(row: {
  advisorMemberPseudonymousLabelingDefault: boolean;
  advisorMemberCollectClientLegalNameDefault: boolean;
  advisorMemberClientDataPolicyLocked: boolean;
}): EnterpriseClientDataPolicy {
  return {
    pseudonymousLabelingDefault: row.advisorMemberPseudonymousLabelingDefault,
    collectClientLegalNameDefault: row.advisorMemberCollectClientLegalNameDefault,
    policyLocked: row.advisorMemberClientDataPolicyLocked,
  };
}

export async function getEnterpriseClientDataPolicyForEnterprise(
  enterpriseId: string,
): Promise<EnterpriseClientDataPolicy> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: enterpriseClientDataPolicySelect,
  });
  if (!enterprise) {
    return DEFAULT_ENTERPRISE_CLIENT_DATA_POLICY;
  }
  return mapEnterpriseClientDataPolicy(enterprise);
}

export function clientDataPolicyInputToEnterpriseUpdate(
  input: EnterpriseClientDataPolicy,
) {
  return {
    advisorMemberPseudonymousLabelingDefault: input.pseudonymousLabelingDefault,
    advisorMemberCollectClientLegalNameDefault: input.collectClientLegalNameDefault,
    advisorMemberClientDataPolicyLocked: input.policyLocked,
  };
}

export function resolveEffectiveAdvisorClientDataPolicy(input: {
  advisorPolicy: PiiPolicy;
  enterprisePolicy: EnterpriseClientDataPolicy | null;
  memberRole: EnterpriseRole | null;
}): EffectiveAdvisorClientDataPolicy {
  const applyEnterpriseLock =
    input.memberRole === "ADVISOR" &&
    input.enterprisePolicy?.policyLocked === true;

  if (applyEnterpriseLock && input.enterprisePolicy) {
    return {
      pseudonymousWorkspaceLabeling:
        input.enterprisePolicy.pseudonymousLabelingDefault,
      fields: {
        ...input.advisorPolicy.fields,
        "User.name": input.enterprisePolicy.collectClientLegalNameDefault,
      },
      lockedByEnterprise: true,
    };
  }

  return {
    pseudonymousWorkspaceLabeling:
      input.advisorPolicy.pseudonymousWorkspaceLabeling,
    fields: { ...input.advisorPolicy.fields },
    lockedByEnterprise: false,
  };
}

export type AdvisorClientDataPolicyContext = {
  enterprisePolicy: EnterpriseClientDataPolicy | null;
  memberRole: EnterpriseRole | null;
  effective: EffectiveAdvisorClientDataPolicy;
  advisorPolicy: PiiPolicy;
};

export async function getAdvisorClientDataPolicyContext(
  userId: string,
): Promise<AdvisorClientDataPolicyContext> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: { piiPolicy: true },
  });
  const advisorPolicy = parsePiiPolicy(profile?.piiPolicy);

  const billing = await resolveBillingContext(userId);
  if (!billing || billing.kind !== "enterprise") {
    return {
      enterprisePolicy: null,
      memberRole: null,
      advisorPolicy,
      effective: resolveEffectiveAdvisorClientDataPolicy({
        advisorPolicy,
        enterprisePolicy: null,
        memberRole: null,
      }),
    };
  }

  const enterprisePolicy = await getEnterpriseClientDataPolicyForEnterprise(
    billing.enterpriseId,
  );

  return {
    enterprisePolicy,
    memberRole: billing.role,
    advisorPolicy,
    effective: resolveEffectiveAdvisorClientDataPolicy({
      advisorPolicy,
      enterprisePolicy,
      memberRole: billing.role,
    }),
  };
}

export async function resolveEffectivePolicyForAdvisorProfile(
  advisorProfileId: string,
  advisorPolicy: PiiPolicy,
): Promise<EffectiveAdvisorClientDataPolicy> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { userId: true, enterpriseId: true },
  });
  if (!profile?.enterpriseId) {
    return resolveEffectiveAdvisorClientDataPolicy({
      advisorPolicy,
      enterprisePolicy: null,
      memberRole: null,
    });
  }

  const [enterprisePolicy, membership] = await Promise.all([
    getEnterpriseClientDataPolicyForEnterprise(profile.enterpriseId),
    prisma.enterpriseMembership.findUnique({
      where: { userId: profile.userId },
      select: { role: true },
    }),
  ]);

  return resolveEffectiveAdvisorClientDataPolicy({
    advisorPolicy,
    enterprisePolicy,
    memberRole: membership?.role ?? null,
  });
}

export function isIntakeFieldLockedByEnterprise(
  field: EligiblePiiField,
  context: AdvisorClientDataPolicyContext,
): boolean {
  return context.effective.lockedByEnterprise && field === "User.name";
}
