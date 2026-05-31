import "server-only";

import { InvitationStatus } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { userEmailForDisplay } from "@/lib/auth/user-email";

const BRANDED_INVITE_STATUSES: InvitationStatus[] = [
  InvitationStatus.SENT,
  InvitationStatus.OPENED,
  InvitationStatus.REGISTERED,
];

export async function isTenantBrandedRequest(): Promise<boolean> {
  const headersList = await headers();
  return headersList.get("x-branded-mode") === "true";
}

export async function getTenantSubdomainFromHeaders(): Promise<string | null> {
  if (!(await isTenantBrandedRequest())) {
    return null;
  }
  return (await headers()).get("x-subdomain");
}

async function resolveClientEmailForBranding(
  userId: string,
  sessionEmail?: string | null
): Promise<string> {
  const fromSession = sessionEmail?.trim().toLowerCase() ?? "";
  if (fromSession) return fromSession;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailCiphertext: true },
  });
  if (!user) return "";

  return userEmailForDisplay(user).trim().toLowerCase();
}

/**
 * True when the client journey must show advisor branding (or an error).
 * Platform-default Akili shell is not acceptable in these contexts.
 */
export async function clientExpectsBrandedPortal(input: {
  userId: string;
  email?: string | null;
}): Promise<boolean> {
  if (await isTenantBrandedRequest()) {
    return true;
  }

  const brandedAssignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      clientId: input.userId,
      status: "ACTIVE",
      advisor: { brandingEnabled: true },
    },
    select: { id: true },
  });
  if (brandedAssignment) {
    return true;
  }

  const clientEmail = await resolveClientEmailForBranding(
    input.userId,
    input.email
  );
  if (!clientEmail) {
    return false;
  }

  const brandedInvite = await prisma.inviteCode.findFirst({
    where: {
      prefillEmail: { equals: clientEmail, mode: "insensitive" },
      status: { in: BRANDED_INVITE_STATUSES },
      createdBy: { not: null },
      advisor: { brandingEnabled: true },
    },
    select: { id: true },
  });

  return Boolean(brandedInvite);
}

export async function inviteSignupExpectsBranding(
  inviteCodeId: string
): Promise<boolean> {
  if (await isTenantBrandedRequest()) {
    return true;
  }

  const invite = await prisma.inviteCode.findUnique({
    where: { id: inviteCodeId },
    select: {
      advisor: {
        select: { brandingEnabled: true },
      },
    },
  });

  return Boolean(invite?.advisor?.brandingEnabled);
}
