import { Page, Text, View } from "@react-pdf/renderer";
import { executiveStyles } from "../executive-styles";
import { EnhancedPageFooter } from "./EnhancedPageFooter";
import { DraftWatermark } from "./DraftWatermark";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

interface AdvisorBriefPagesProps {
  advisorNotes: string | null;
  meetingAgenda: string | null;
  discussionPrompts: string[];
  reportingPeriodLabel: string;
  branding: AdvisorBrandingData | null;
  companyName: string;
  draft: boolean;
}

/**
 * Advisor Brief pages -- rendered ONLY when variant === "advisor" (D-17, D-18).
 * Never include in client variant. Header marks pages as internal use only.
 *
 * These pages are NOT guarded here -- the guard lives in ExecutiveReport.tsx
 * which conditionally renders this component only for variant === "advisor".
 */
export function AdvisorBriefPages({
  advisorNotes,
  meetingAgenda,
  discussionPrompts,
  reportingPeriodLabel,
  branding,
  draft,
}: AdvisorBriefPagesProps) {
  return (
    <>
      {/* Advisor Notes + Meeting Agenda (single page) */}
      <Page size="A4" style={executiveStyles.page}>
        {/* Internal use header */}
        <Text style={executiveStyles.advisorBriefHeader}>
          ADVISOR BRIEF -- INTERNAL USE ONLY
        </Text>

        <Text style={executiveStyles.sectionTitle}>Advisor Notes</Text>

        {advisorNotes ? (
          <View style={{ marginBottom: 24 }}>
            <Text style={executiveStyles.bodyText}>{advisorNotes}</Text>
          </View>
        ) : (
          <Text
            style={[executiveStyles.bodyText, { color: "#9ca3af", fontStyle: "italic", marginBottom: 24 }]}
          >
            No advisor notes for this report.
          </Text>
        )}

        <View style={executiveStyles.divider} />

        <Text style={[executiveStyles.subSectionTitle, { marginTop: 16 }]}>
          Meeting Agenda
        </Text>

        {meetingAgenda ? (
          <View style={{ marginBottom: 24 }}>
            <Text style={executiveStyles.bodyText}>{meetingAgenda}</Text>
          </View>
        ) : (
          <Text
            style={[executiveStyles.bodyText, { color: "#9ca3af", fontStyle: "italic" }]}
          >
            No meeting agenda has been set for this report.
          </Text>
        )}

        <Text style={executiveStyles.reportingPeriodText}>
          Reporting Period: {reportingPeriodLabel}
        </Text>

        <EnhancedPageFooter branding={branding ?? undefined} />
        {draft ? <DraftWatermark /> : null}
      </Page>

      {/* Discussion Prompts page */}
      <Page size="A4" style={executiveStyles.page}>
        <Text style={executiveStyles.advisorBriefHeader}>
          ADVISOR BRIEF -- INTERNAL USE ONLY
        </Text>

        <Text style={executiveStyles.sectionTitle}>Discussion Prompts</Text>
        <Text style={[executiveStyles.bodyText, { marginBottom: 16 }]}>
          Use these prompts to guide the client conversation.
        </Text>

        {discussionPrompts.length === 0 ? (
          <Text
            style={[executiveStyles.bodyText, { color: "#9ca3af", fontStyle: "italic" }]}
          >
            No discussion prompts have been added to this report.
          </Text>
        ) : (
          discussionPrompts.map((prompt, idx) => (
            <View key={idx} style={executiveStyles.listItem}>
              <Text style={executiveStyles.listBullet}>{idx + 1}.</Text>
              <Text style={executiveStyles.listText}>{prompt}</Text>
            </View>
          ))
        )}

        <Text style={executiveStyles.reportingPeriodText}>
          Reporting Period: {reportingPeriodLabel}
        </Text>

        <EnhancedPageFooter branding={branding ?? undefined} />
        {draft ? <DraftWatermark /> : null}
      </Page>
    </>
  );
}
