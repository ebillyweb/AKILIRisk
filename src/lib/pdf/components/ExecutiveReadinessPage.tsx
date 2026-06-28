import { Page, Text, View } from "@react-pdf/renderer";
import { executiveStyles, tierBgColor } from "../executive-styles";
import { EnhancedPageFooter } from "./EnhancedPageFooter";
import { DraftWatermark } from "./DraftWatermark";
import type { ExecutiveReadinessTier } from "../executive-report-types";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

interface ExecutiveReadinessPageProps {
  executiveReadiness: ExecutiveReadinessTier;
  clientName: string;
  reportingPeriodLabel: string;
  branding: AdvisorBrandingData | null;
  companyName: string;
  draft: boolean;
}

export function ExecutiveReadinessPage({
  executiveReadiness,
  clientName,
  reportingPeriodLabel,
  branding,
  companyName,
  draft,
}: ExecutiveReadinessPageProps) {
  const { tier, highestRiskDomains, strongestDomains, strategicPriorities } =
    executiveReadiness;

  return (
    <Page size="A4" style={executiveStyles.page}>
      <Text style={executiveStyles.sectionTitle}>Executive Readiness</Text>
      <Text style={[executiveStyles.bodyText, { marginBottom: 20 }]}>
        Prepared for {clientName} &bull; {reportingPeriodLabel}
      </Text>

      {/* Tier badge -- colored rectangle per D-10, no SVG */}
      <View style={{ marginBottom: 24 }}>
        <View
          style={[
            executiveStyles.tierBadge,
            { backgroundColor: tierBgColor(tier) },
          ]}
        >
          <Text style={executiveStyles.tierBadgeText}>{tier.toUpperCase()}</Text>
        </View>
        <Text
          style={[executiveStyles.bodyText, { marginTop: 8, color: "#6b7280" }]}
        >
          Overall Readiness Tier
        </Text>
      </View>

      <View style={executiveStyles.divider} />

      {/* Highest Risk Domains */}
      <View style={{ marginBottom: 20 }}>
        <Text style={executiveStyles.subSectionTitle}>
          Highest Risk Domains
        </Text>
        {highestRiskDomains.length === 0 ? (
          <Text style={executiveStyles.bodyText}>No high-risk domains identified.</Text>
        ) : (
          highestRiskDomains.map((domain, idx) => (
            <View key={idx} style={executiveStyles.domainRow}>
              <View
                style={[
                  executiveStyles.domainDot,
                  { backgroundColor: "#dc2626" },
                ]}
              />
              <Text style={executiveStyles.domainLabel}>{domain}</Text>
            </View>
          ))
        )}
      </View>

      {/* Strongest Domains */}
      <View style={{ marginBottom: 20 }}>
        <Text style={executiveStyles.subSectionTitle}>Strongest Domains</Text>
        {strongestDomains.length === 0 ? (
          <Text style={executiveStyles.bodyText}>No low-risk domains yet.</Text>
        ) : (
          strongestDomains.map((domain, idx) => (
            <View key={idx} style={executiveStyles.domainRow}>
              <View
                style={[
                  executiveStyles.domainDot,
                  { backgroundColor: "#059669" },
                ]}
              />
              <Text style={executiveStyles.domainLabel}>{domain}</Text>
            </View>
          ))
        )}
      </View>

      {/* Strategic Priorities */}
      {strategicPriorities.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={executiveStyles.subSectionTitle}>
            Strategic Priorities
          </Text>
          {strategicPriorities.map((priority, idx) => (
            <View key={idx} style={executiveStyles.listItem}>
              <Text style={executiveStyles.listBullet}>{idx + 1}.</Text>
              <Text style={executiveStyles.listText}>{priority}</Text>
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
