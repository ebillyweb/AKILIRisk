import type { UserRole } from "@prisma/client";

export type EnterpriseProvisionActor = {
  userId: string;
  email: string | null;
  role: UserRole;
};
