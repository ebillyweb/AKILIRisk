"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getClientOptionalPiiSettings,
  SETTINGS_OPTIONAL_PII_FIELDS,
  type SettingsOptionalPiiField,
} from "@/lib/advisor/client-optional-pii-settings";
import {
  encryptClientPhone,
  encryptUserName,
} from "@/lib/data/client-pii";
import {
  clientOptionalPiiSchema,
  type ClientOptionalPiiFormData,
} from "@/lib/schemas/profile";
import { revalidatePath } from "next/cache";
import { recordPiiFieldConsent } from "@/lib/actions/pii-field-consent-actions";

export type ClientOptionalPiiActionResult =
  | { success: true }
  | { success: false; error: string };

export async function getClientOptionalPiiFormData(): Promise<{
  success: boolean;
  data: ClientOptionalPiiFormData & {
    offeredFields: SettingsOptionalPiiField[];
    consentGranted: Partial<Record<SettingsOptionalPiiField, boolean>>;
  } | null;
  error: string | null;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, data: null, error: "Not authenticated" };
  }

  const settings = await getClientOptionalPiiSettings(session.user.id);
  if (!settings) {
    return { success: false, data: null, error: "No active advisor assignment" };
  }

  return {
    success: true,
    data: {
      legalName: settings.legalName,
      phone: settings.phone,
      offeredFields: settings.offeredFields,
      consentGranted: settings.consentGranted,
    },
    error: null,
  };
}

export async function updateClientOptionalPii(
  data: unknown
): Promise<ClientOptionalPiiActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const parsed = clientOptionalPiiSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Invalid data" };
  }

  const settings = await getClientOptionalPiiSettings(session.user.id);
  if (!settings) {
    return { success: false, error: "No active advisor assignment" };
  }

  const offered = new Set(settings.offeredFields);
  const legalNameTrimmed = parsed.data.legalName?.trim() ?? "";
  const phoneTrimmed = parsed.data.phone?.trim() ?? "";

  if (legalNameTrimmed && !offered.has("User.name")) {
    return { success: false, error: "Your advisor does not collect legal name." };
  }
  if (phoneTrimmed && !offered.has("ClientProfile.phone")) {
    return { success: false, error: "Your advisor does not collect phone." };
  }

  const userId = session.user.id;

  if (offered.has("User.name")) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: legalNameTrimmed ? encryptUserName(legalNameTrimmed) : null,
      },
    });
  }

  if (offered.has("ClientProfile.phone")) {
    await prisma.clientProfile.upsert({
      where: { userId },
      create: {
        userId,
        phone: phoneTrimmed ? encryptClientPhone(phoneTrimmed) : null,
      },
      update: {
        phone: phoneTrimmed ? encryptClientPhone(phoneTrimmed) : null,
      },
    });
  }

  for (const field of SETTINGS_OPTIONAL_PII_FIELDS) {
    if (!offered.has(field)) continue;
    const value =
      field === "User.name" ? legalNameTrimmed : phoneTrimmed;
    if (!value) continue;
    if (settings.consentGranted[field]) continue;

    const consent = await recordPiiFieldConsent({ field });
    if (!consent.ok) {
      return { success: false, error: consent.message };
    }
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}
