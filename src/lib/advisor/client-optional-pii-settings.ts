import "server-only";

import { prisma } from "@/lib/db";
import {
  parseAssignmentFieldVisibility,
} from "@/lib/advisor/field-visibility";
import {
  parsePiiPolicy,
  type EligiblePiiField,
} from "@/lib/advisor/pii-policy";

/** Settings-surface optional PII fields (household fields live on /profiles). */
export const SETTINGS_OPTIONAL_PII_FIELDS = [
  "User.name",
  "ClientProfile.phone",
] as const satisfies readonly EligiblePiiField[];

export type SettingsOptionalPiiField =
  (typeof SETTINGS_OPTIONAL_PII_FIELDS)[number];

export interface ClientOptionalPiiSettings {
  /** Fields at least one active advisor collects via piiPolicy. */
  offeredFields: SettingsOptionalPiiField[];
  legalName: string;
  phone: string;
  /** Whether the client already granted advisor visibility per field. */
  consentGranted: Partial<Record<SettingsOptionalPiiField, boolean>>;
}

/** Load optional PII form state for /settings. */
export async function getClientOptionalPiiSettings(
  clientUserId: string
): Promise<ClientOptionalPiiSettings | null> {
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "asc" },
    select: {
      fieldVisibility: true,
      advisor: { select: { piiPolicy: true } },
    },
  });

  if (assignments.length === 0) return null;

  const offered = new Set<SettingsOptionalPiiField>();
  for (const row of assignments) {
    const policy = parsePiiPolicy(row.advisor.piiPolicy);
    for (const field of SETTINGS_OPTIONAL_PII_FIELDS) {
      if (policy.fields[field]) offered.add(field);
    }
  }

  if (offered.size === 0) {
    return {
      offeredFields: [],
      legalName: "",
      phone: "",
      consentGranted: {},
    };
  }

  const primaryVisibility = parseAssignmentFieldVisibility(
    assignments[0].fieldVisibility
  );
  const consentGranted: Partial<Record<SettingsOptionalPiiField, boolean>> =
    {};
  for (const field of SETTINGS_OPTIONAL_PII_FIELDS) {
    if (offered.has(field)) {
      consentGranted[field] = primaryVisibility[field] ?? false;
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: clientUserId },
    select: {
      name: true,
      clientProfile: { select: { id: true, phone: true } },
    },
  });
  if (!user) return null;

  const { safeDecryptUserName, safeDecryptClientPhone } = await import(
    "@/lib/data/client-pii"
  );

  return {
    offeredFields: [...offered],
    legalName:
      safeDecryptUserName(user.name, { rowId: clientUserId }) ?? "",
    phone: user.clientProfile
      ? safeDecryptClientPhone(user.clientProfile.phone, {
          rowId: user.clientProfile.id,
        }) ?? ""
      : "",
    consentGranted,
  };
}

/** Whether any advisor collects optional PII on the settings surface. */
export function settingsOffersOptionalPii(
  settings: ClientOptionalPiiSettings | null
): settings is ClientOptionalPiiSettings {
  return settings !== null && settings.offeredFields.length > 0;
}
