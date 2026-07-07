import "server-only";

import { prisma } from "@/lib/db";
import {
  isAllowedAdminBrandingLogoS3Key,
  resolveAdminAdvisorListBranding,
} from "@/lib/admin/advisor-list-branding";

export async function resolveAdminAdvisorLogoForUser(userId: string): Promise<{
  logoS3Key: string;
  logoContentType: string | null;
} | null> {
  const advisor = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: {
      firmName: true,
      brandName: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      logoUrl: true,
      logoS3Key: true,
      logoContentType: true,
      enterpriseId: true,
      enterprise: {
        select: {
          name: true,
          brandName: true,
          primaryColor: true,
          secondaryColor: true,
          accentColor: true,
          logoUrl: true,
          logoS3Key: true,
          brandingEnabled: true,
        },
      },
      user: { select: { role: true } },
    },
  });

  if (!advisor || advisor.user.role !== "ADVISOR") {
    return null;
  }

  const branding = resolveAdminAdvisorListBranding(
    {
      firmName: advisor.firmName,
      brandName: advisor.brandName,
      primaryColor: advisor.primaryColor,
      secondaryColor: advisor.secondaryColor,
      accentColor: advisor.accentColor,
      logoUrl: advisor.logoUrl,
      logoS3Key: advisor.logoS3Key,
    },
    advisor.enterprise,
    { linkedToEnterprise: Boolean(advisor.enterpriseId) },
  );

  const logoS3Key = branding.logoS3Key?.trim();
  if (!logoS3Key || !isAllowedAdminBrandingLogoS3Key(logoS3Key)) {
    return null;
  }

  return {
    logoS3Key,
    logoContentType: advisor.logoContentType,
  };
}
