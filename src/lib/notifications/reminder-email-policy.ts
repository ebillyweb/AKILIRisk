import "server-only";

import { prisma } from "@/lib/db";

export type ReminderEmailPolicy = {
  clientReminderEmailsEnabled: boolean;
  advisorReminderEmailsEnabled: boolean;
};

export const DEFAULT_REMINDER_EMAIL_POLICY: ReminderEmailPolicy = {
  clientReminderEmailsEnabled: true,
  advisorReminderEmailsEnabled: true,
};

export function resolveReminderEmailPolicy(input: {
  clientReminderEmailsEnabled: boolean;
  advisorReminderEmailsEnabled: boolean;
}): ReminderEmailPolicy {
  return {
    clientReminderEmailsEnabled: input.clientReminderEmailsEnabled,
    advisorReminderEmailsEnabled: input.advisorReminderEmailsEnabled,
  };
}

export async function getReminderEmailPolicyForAdvisorProfile(
  advisorProfileId: string,
): Promise<ReminderEmailPolicy> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      clientReminderEmailsEnabled: true,
      advisorReminderEmailsEnabled: true,
      enterpriseId: true,
      enterprise: {
        select: {
          clientReminderEmailsEnabled: true,
          advisorReminderEmailsEnabled: true,
        },
      },
    },
  });

  if (!profile) {
    return DEFAULT_REMINDER_EMAIL_POLICY;
  }

  if (profile.enterpriseId && profile.enterprise) {
    return resolveReminderEmailPolicy(profile.enterprise);
  }

  return resolveReminderEmailPolicy(profile);
}
