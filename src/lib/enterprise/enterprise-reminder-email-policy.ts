import "server-only";

import { prisma } from "@/lib/db";
import {
  resolveReminderEmailPolicy,
  type ReminderEmailPolicy,
} from "@/lib/notifications/reminder-email-policy";

export type EnterpriseReminderEmailPolicy = ReminderEmailPolicy;

export async function getEnterpriseReminderEmailPolicyForEnterprise(
  enterpriseId: string,
): Promise<EnterpriseReminderEmailPolicy> {
  const row = await prisma.advisorEnterprise.findUniqueOrThrow({
    where: { id: enterpriseId },
    select: {
      clientReminderEmailsEnabled: true,
      advisorReminderEmailsEnabled: true,
    },
  });

  return resolveReminderEmailPolicy(row);
}

export function reminderEmailPolicyInputToEnterpriseUpdate(
  policy: EnterpriseReminderEmailPolicy,
): Pick<
  typeof policy,
  "clientReminderEmailsEnabled" | "advisorReminderEmailsEnabled"
> {
  return {
    clientReminderEmailsEnabled: policy.clientReminderEmailsEnabled,
    advisorReminderEmailsEnabled: policy.advisorReminderEmailsEnabled,
  };
}
