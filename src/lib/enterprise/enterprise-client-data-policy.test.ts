import { describe, expect, it } from "vitest";

import { DEFAULT_PII_POLICY } from "@/lib/advisor/pii-policy";
import {
  DEFAULT_ENTERPRISE_CLIENT_DATA_POLICY,
  resolveEffectiveAdvisorClientDataPolicy,
} from "@/lib/enterprise/enterprise-client-data-policy";

describe("resolveEffectiveAdvisorClientDataPolicy", () => {
  const advisorPolicy = {
    ...DEFAULT_PII_POLICY,
    pseudonymousWorkspaceLabeling: false,
    fields: {
      ...DEFAULT_PII_POLICY.fields,
      "User.name": true,
    },
  };

  it("returns advisor policy when no enterprise lock applies", () => {
    expect(
      resolveEffectiveAdvisorClientDataPolicy({
        advisorPolicy,
        enterprisePolicy: null,
        memberRole: null,
      }),
    ).toEqual({
      pseudonymousWorkspaceLabeling: false,
      fields: advisorPolicy.fields,
      lockedByEnterprise: false,
    });
  });

  it("locks ADVISOR-role members to firm defaults when policyLocked is true", () => {
    expect(
      resolveEffectiveAdvisorClientDataPolicy({
        advisorPolicy,
        enterprisePolicy: {
          pseudonymousLabelingDefault: true,
          collectClientLegalNameDefault: false,
          policyLocked: true,
        },
        memberRole: "ADVISOR",
      }),
    ).toEqual({
      pseudonymousWorkspaceLabeling: true,
      fields: {
        ...advisorPolicy.fields,
        "User.name": false,
      },
      lockedByEnterprise: true,
    });
  });

  it("does not lock firm owners to enterprise defaults", () => {
    expect(
      resolveEffectiveAdvisorClientDataPolicy({
        advisorPolicy,
        enterprisePolicy: {
          ...DEFAULT_ENTERPRISE_CLIENT_DATA_POLICY,
          pseudonymousLabelingDefault: true,
          policyLocked: true,
        },
        memberRole: "OWNER",
      }).lockedByEnterprise,
    ).toBe(false);
  });

  it("does not lock when enterprise policy is unlocked", () => {
    expect(
      resolveEffectiveAdvisorClientDataPolicy({
        advisorPolicy,
        enterprisePolicy: {
          pseudonymousLabelingDefault: true,
          collectClientLegalNameDefault: false,
          policyLocked: false,
        },
        memberRole: "ADVISOR",
      }).lockedByEnterprise,
    ).toBe(false);
  });
});
