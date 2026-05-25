import "server-only";

import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { safeDecryptUserName } from "@/lib/data/client-pii";
import {
  ELIGIBLE_PII_FIELDS,
  parsePiiPolicy,
  type EligiblePiiField,
  type PiiPolicy,
} from "@/lib/advisor/pii-policy";

/** Consent map stored on `ClientAdvisorAssignment.fieldVisibility`.
 *  Omitted keys and null assignment visibility mean no opt-in yet. */
export function parseAssignmentFieldVisibility(
  raw: unknown
): Record<EligiblePiiField, boolean> {
  const fields = Object.fromEntries(
    ELIGIBLE_PII_FIELDS.map((field) => [field, false])
  ) as Record<EligiblePiiField, boolean>;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fields;
  }

  for (const field of ELIGIBLE_PII_FIELDS) {
    const value = (raw as Record<string, unknown>)[field];
    if (typeof value === "boolean") {
      fields[field] = value;
    }
  }
  return fields;
}

/** Effective advisor visibility = advisor policy AND client consent. */
export function resolveEffectiveFieldVisibility(
  advisorPolicy: PiiPolicy,
  fieldVisibility: unknown
): Record<EligiblePiiField, boolean> {
  const consent = parseAssignmentFieldVisibility(fieldVisibility);
  const effective = {} as Record<EligiblePiiField, boolean>;
  for (const field of ELIGIBLE_PII_FIELDS) {
    effective[field] =
      advisorPolicy.fields[field] === true && consent[field] === true;
  }
  return effective;
}

export function isPiiFieldVisibleToAdvisor(
  field: EligiblePiiField,
  effective: Record<EligiblePiiField, boolean>
): boolean {
  return effective[field] === true;
}

export async function loadAdvisorPiiPolicy(
  advisorProfileId: string
): Promise<PiiPolicy> {
  const row = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { piiPolicy: true },
  });
  return parsePiiPolicy(row?.piiPolicy);
}

export function buildEffectiveVisibilityByClientId(
  advisorPolicy: PiiPolicy,
  assignments: Array<{ clientId: string; fieldVisibility: unknown }>
): Map<string, Record<EligiblePiiField, boolean>> {
  const map = new Map<string, Record<EligiblePiiField, boolean>>();
  for (const assignment of assignments) {
    map.set(
      assignment.clientId,
      resolveEffectiveFieldVisibility(advisorPolicy, assignment.fieldVisibility)
    );
  }
  return map;
}

/** Advisor-facing display name: legal name when consented, else email. */
export function advisorClientDisplayName(
  decryptedName: string | null | undefined,
  email: string,
  effective: Record<EligiblePiiField, boolean>
): string {
  if (
    isPiiFieldVisibleToAdvisor("User.name", effective) &&
    decryptedName &&
    decryptedName.trim().length > 0
  ) {
    return decryptedName;
  }
  return email;
}

type ClientNameSource = {
  id: string;
  name: string | null;
  emailCiphertext: string;
};

/** Decrypt + apply Option D visibility for a single client row. */
export function resolveAdvisorClientIdentity(
  client: ClientNameSource,
  fieldVisibility: unknown,
  advisorPolicy: PiiPolicy
): { name: string; email: string } {
  const email = decryptUserEmail(client.emailCiphertext);
  const effective = resolveEffectiveFieldVisibility(
    advisorPolicy,
    fieldVisibility
  );
  const name = advisorClientDisplayName(
    safeDecryptUserName(client.name, { rowId: client.id }),
    email,
    effective
  );
  return { name, email };
}
