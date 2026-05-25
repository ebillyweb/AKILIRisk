import "server-only";

import { decryptUserEmail } from "@/lib/auth/user-email";
import { prisma } from "@/lib/db";
import { getAdvisorBrandingForPDF } from "@/lib/pdf/branding-integration";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import {
  getHouseholdProfileForAdvisorView,
  getHouseholdProfileForClientAssessment,
} from "@/lib/household/member-profile";
import { mapAssessmentToTemplate } from "./data-mapper";
import { loadPillarScoreForTemplate } from "./resolve-pillar-score";
import type { TemplateData, TemplateId, TemplateMetadata } from "./types";

export type PreparePolicyDocumentInput = {
  assessmentId: string;
  templateId: TemplateId;
  clientUserId: string;
  advisorProfileId: string | null;
  advisorView: boolean;
};

export type PreparedPolicyDocument =
  | { ok: false; reason: "not_scored" }
  | {
      ok: true;
      templateData: TemplateData;
      branding: AdvisorBrandingData | null;
      templateMetadata: TemplateMetadata;
    };

export async function preparePolicyDocument(
  input: PreparePolicyDocumentInput,
  templateMetadata: TemplateMetadata
): Promise<PreparedPolicyDocument> {
  const scoreData = await loadPillarScoreForTemplate(
    input.assessmentId,
    input.templateId
  );
  if (!scoreData) {
    return { ok: false, reason: "not_scored" };
  }

  const client = await prisma.user.findUnique({
    where: { id: input.clientUserId },
    select: { emailCiphertext: true },
  });
  const familyEmail = client
    ? decryptUserEmail(client.emailCiphertext)
    : "household@example.com";

  const householdProfile = input.advisorView
    ? await getHouseholdProfileForAdvisorView(input.clientUserId)
    : await getHouseholdProfileForClientAssessment(input.clientUserId);

  const templateData = mapAssessmentToTemplate(
    input.templateId,
    scoreData,
    familyEmail,
    householdProfile
  );

  const branding = input.advisorProfileId
    ? await getAdvisorBrandingForPDF(input.advisorProfileId)
    : null;

  return {
    ok: true,
    templateData,
    branding,
    templateMetadata,
  };
}
