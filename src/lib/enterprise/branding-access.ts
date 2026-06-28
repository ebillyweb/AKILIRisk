import "server-only";

import { resolveBillingContext } from "@/lib/enterprise/billing-context";
import {
  resolveAdvisorBrandingForProfile,
} from "@/lib/enterprise/branding";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import { prisma } from "@/lib/db";

export type AdvisorBrandingSettingsContext =
  | { mode: "solo" }
  | {
      mode: "enterprise-manage";
      enterpriseId: string;
      enterpriseName: string;
    }
  | {
      mode: "enterprise-view";
      enterpriseId: string;
      enterpriseName: string;
    };

export type BrandingSettingsProfile = {
  firmName?: string | null;
  brandName?: string | null;
  tagline?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  websiteUrl?: string | null;
  emailFooterText?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  logoUrl?: string | null;
  logoS3Key?: string | null;
  logoContentType?: string | null;
  logoFileSize?: number | null;
  logoUploadedAt?: Date | null;
};

export type AdvisorBrandingSettingsView = {
  context: AdvisorBrandingSettingsContext;
  profile: BrandingSettingsProfile;
  readOnly: boolean;
  readOnlyNotice?: string;
};

function mapResolvedBrandingToProfile(
  branding: AdvisorBrandingData,
): BrandingSettingsProfile {
  return {
    firmName: branding.advisorFirmName ?? branding.brandName,
    brandName: branding.brandName,
    tagline: branding.tagline,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
    websiteUrl: branding.websiteUrl,
    emailFooterText: branding.emailFooterText,
    supportEmail: branding.supportEmail,
    supportPhone: branding.supportPhone,
    logoUrl: branding.logoUrl,
    logoS3Key: branding.logoS3Key,
    logoContentType: branding.logoContentType,
    logoFileSize: branding.logoFileSize,
    logoUploadedAt: branding.logoUploadedAt,
  };
}

export async function resolveAdvisorBrandingSettingsContext(
  userId: string,
): Promise<AdvisorBrandingSettingsContext> {
  const ctx = await resolveBillingContext(userId);
  if (!ctx || ctx.kind !== "enterprise") {
    return { mode: "solo" };
  }

  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: ctx.enterpriseId },
    select: { name: true },
  });
  if (!enterprise) {
    return { mode: "solo" };
  }

  if (ctx.role === "OWNER" || ctx.role === "ADMIN") {
    return {
      mode: "enterprise-manage",
      enterpriseId: ctx.enterpriseId,
      enterpriseName: enterprise.name,
    };
  }

  return {
    mode: "enterprise-view",
    enterpriseId: ctx.enterpriseId,
    enterpriseName: enterprise.name,
  };
}

export async function isAdvisorBrandingReadOnly(userId: string): Promise<boolean> {
  const context = await resolveAdvisorBrandingSettingsContext(userId);
  return context.mode === "enterprise-view";
}

export async function assertCanMutateAdvisorBranding(userId: string): Promise<void> {
  if (await isAdvisorBrandingReadOnly(userId)) {
    throw new Error(
      "Firm branding is read-only for your role. Contact a firm owner or administrator to request changes.",
    );
  }
}

export async function loadAdvisorBrandingSettingsView(
  userId: string,
  advisorProfileId: string,
): Promise<AdvisorBrandingSettingsView> {
  const context = await resolveAdvisorBrandingSettingsContext(userId);

  const advisorProfile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      firmName: true,
      brandName: true,
      tagline: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      websiteUrl: true,
      emailFooterText: true,
      supportEmail: true,
      supportPhone: true,
      logoUrl: true,
      logoS3Key: true,
      logoContentType: true,
      logoFileSize: true,
      logoUploadedAt: true,
    },
  });

  if (!advisorProfile) {
    throw new Error("Advisor profile not found");
  }

  const baseProfile: BrandingSettingsProfile = advisorProfile;

  if (context.mode === "solo") {
    return { context, profile: baseProfile, readOnly: false };
  }

  const resolved = await resolveAdvisorBrandingForProfile(advisorProfileId);
  const profile = resolved ? mapResolvedBrandingToProfile(resolved) : baseProfile;

  if (context.mode === "enterprise-view") {
    return {
      context,
      profile,
      readOnly: true,
      readOnlyNotice: `Firm branding for ${context.enterpriseName} is managed by your firm owner or administrators. You can review how clients see the firm below.`,
    };
  }

  return { context, profile, readOnly: false };
}
