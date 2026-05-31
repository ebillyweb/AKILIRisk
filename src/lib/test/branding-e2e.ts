import "server-only";

import { findUserByEmail } from "@/lib/auth/user-email";
import { prisma } from "@/lib/db";

const TEST_EMAIL_SUFFIX = "@test.com";

export interface BrandingE2EBaseline {
  tagline: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  brandingEnabled: boolean;
}

export interface PrepareBrandingE2EInput {
  advisorEmail: string;
  /** Restore profile branding fields before/after a smoke run. */
  restore?: BrandingE2EBaseline;
  /** Guarantee white-label is on for advisor@test.com-style fixtures. */
  ensureBrandingEnabled?: boolean;
}

export interface PrepareBrandingE2EResult {
  advisorEmail: string;
  advisorId: string;
  advisorUserId: string;
  baseline: BrandingE2EBaseline;
  restored?: boolean;
}

function assertTestEmail(email: string): void {
  if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
    throw new Error(
      "Test branding prepare is restricted to *@test.com advisor accounts."
    );
  }
}

async function loadAdvisorProfile(userId: string) {
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      tagline: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      brandingEnabled: true,
    },
  });
  if (!profile) {
    throw new Error("Advisor profile not found");
  }
  return profile;
}

function toBaseline(
  profile: Awaited<ReturnType<typeof loadAdvisorProfile>>
): BrandingE2EBaseline {
  return {
    tagline: profile.tagline,
    primaryColor: profile.primaryColor,
    secondaryColor: profile.secondaryColor,
    accentColor: profile.accentColor,
    brandingEnabled: profile.brandingEnabled,
  };
}

export async function prepareBrandingForE2E(
  input: PrepareBrandingE2EInput
): Promise<PrepareBrandingE2EResult> {
  const email = input.advisorEmail.trim().toLowerCase();
  assertTestEmail(email);

  const user = await findUserByEmail(email, { select: { id: true } });
  if (!user?.id) {
    throw new Error("User not found");
  }

  const profile = await loadAdvisorProfile(user.id);

  if (input.ensureBrandingEnabled && !profile.brandingEnabled) {
    await prisma.advisorProfile.update({
      where: { id: profile.id },
      data: { brandingEnabled: true },
    });
    profile.brandingEnabled = true;
  }

  if (input.restore) {
    await prisma.advisorProfile.update({
      where: { id: profile.id },
      data: {
        tagline: input.restore.tagline,
        primaryColor: input.restore.primaryColor,
        secondaryColor: input.restore.secondaryColor,
        accentColor: input.restore.accentColor,
        brandingEnabled: input.restore.brandingEnabled,
      },
    });
    return {
      advisorEmail: email,
      advisorId: profile.id,
      advisorUserId: user.id,
      baseline: input.restore,
      restored: true,
    };
  }

  return {
    advisorEmail: email,
    advisorId: profile.id,
    advisorUserId: user.id,
    baseline: toBaseline(profile),
  };
}
