import { Page, Text, View } from "@react-pdf/renderer";
import { executiveStyles } from "../executive-styles";
import { EnhancedPageFooter } from "./EnhancedPageFooter";
import { DraftWatermark } from "./DraftWatermark";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

interface NextStepsPageProps {
  nextSteps: string[];
  reportingPeriodLabel: string;
  branding: AdvisorBrandingData | null;
  companyName: string;
  draft: boolean;
}

/**
 * Next recommended steps page (D-05 -- always present).
 * Numbered list with action-oriented formatting (D-24 reporting period footer).
 */
export function NextStepsPage({
  nextSteps,
  reportingPeriodLabel,
  branding,
  draft,
}: NextStepsPageProps) {
  return (
    <Page size="A4" style={executiveStyles.page}>
      <Text style={executiveStyles.sectionTitle}>Next Recommended Steps</Text>
      <Text style={[executiveStyles.bodyText, { marginBottom: 20 }]}>
        Advisor-recommended actions to advance your risk posture in the coming
        period.
      </Text>

      {nextSteps.length === 0 ? (
        <Text style={executiveStyles.zeroStateText}>
          Next steps will be outlined here once your advisor reviews your
          current risk profile.
        </Text>
      ) : (
        <View>
          {nextSteps.map((step, idx) => (
            <View
              key={idx}
              style={[
                executiveStyles.listItem,
                {
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  backgroundColor: idx % 2 === 0 ? "#f9fafb" : "#ffffff",
                  borderLeftWidth: 3,
                  borderLeftColor: "#1a1a2e",
                  marginBottom: 8,
                },
              ]}
            >
              <Text
                style={[
                  executiveStyles.listBullet,
                  { fontWeight: "bold", color: "#1a1a2e" },
                ]}
              >
                {idx + 1}.
              </Text>
              <Text style={executiveStyles.listText}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={executiveStyles.reportingPeriodText}>
        Reporting Period: {reportingPeriodLabel}
      </Text>

      <EnhancedPageFooter branding={branding ?? undefined} />
      {draft ? <DraftWatermark /> : null}
    </Page>
  );
}
