export type AdvisorListBrandingFields = {
  firmName: string | null;
  brandName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  logoS3Key: string | null;
};

export type EnterpriseListBrandingFields = {
  name: string;
  brandName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  logoS3Key: string | null;
  brandingEnabled: boolean;
};

/** Firm members use canonical enterprise branding on admin advisor cards. */
export function resolveAdminAdvisorListBranding(
  profile: AdvisorListBrandingFields,
  enterprise: EnterpriseListBrandingFields | null | undefined,
  opts?: { linkedToEnterprise?: boolean },
): AdvisorListBrandingFields {
  const linked = opts?.linkedToEnterprise ?? Boolean(enterprise);
  if (!linked || !enterprise?.brandingEnabled) {
    return profile;
  }

  return {
    firmName: enterprise.name,
    brandName: enterprise.brandName?.trim() || enterprise.name,
    primaryColor: enterprise.primaryColor,
    secondaryColor: enterprise.secondaryColor,
    accentColor: enterprise.accentColor,
    logoUrl: enterprise.logoUrl,
    logoS3Key: enterprise.logoS3Key,
  };
}

export function isAllowedAdminBrandingLogoS3Key(key: string): boolean {
  return /^advisors\/[^/]+\/logos\//.test(key.trim());
}
