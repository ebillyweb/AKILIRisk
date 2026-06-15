import { Page, Text, View, Image } from '@react-pdf/renderer';
import { createBrandedStyles, getRiskColor } from '../enhanced-styles';
import { AdvisorBrandingData } from '@/lib/validation/branding';

interface EnhancedReportCoverProps {
  assessmentDate: string;
  completionPercentage: number;
  overallScore: number;
  riskLevel: string;
  clientName?: string;
  reportType?: string;
  branding?: AdvisorBrandingData;
}

export function EnhancedReportCover({
  assessmentDate,
  completionPercentage,
  overallScore,
  riskLevel,
  clientName,
  reportType = 'Personal Risk Profile Report',
  branding,
}: EnhancedReportCoverProps) {
  const styles = createBrandedStyles(branding);

  // Determine brand display name with fallbacks
  const brandDisplayName = branding?.brandName || branding?.advisorFirmName || 'Akili Risk';

  return (
    <Page size="A4" style={styles.page}>
      {/* Branded Header */}
      <View style={styles.coverHeader}>
        {branding?.logoUrl && (
          <View style={styles.logoContainer}>
            <Image
              src={branding.logoUrl}
              style={styles.logo}
            />
          </View>
        )}
        <Text style={styles.brandNameLarge}>
          {brandDisplayName}
        </Text>
        {branding?.tagline && (
          <Text style={styles.brandTagline}>
            {branding.tagline}
          </Text>
        )}
      </View>

      {/* Main Content */}
      <View style={{ textAlign: 'center', marginTop: 60 }}>
        <Text style={styles.coverTitle}>
          {reportType.replace(' ', '\n')}
        </Text>

        <Text style={styles.coverSubtitle}>
          Confidential Risk Analysis & Recommendations
        </Text>

        {clientName && (
          <Text style={[styles.subheader, { marginTop: 20 }]}>
            Prepared for: {clientName}
          </Text>
        )}

        {/* Score Display */}
        <View style={styles.scoreDisplay}>
          <Text style={styles.scoreNumber}>{overallScore.toFixed(1)}/10</Text>
          <View
            style={[
              styles.riskBadge,
              { backgroundColor: getRiskColor(riskLevel) },
            ]}
          >
            <Text style={styles.riskBadgeText}>{riskLevel} RISK</Text>
          </View>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Assessment Date</Text>
            <Text style={styles.metricValue}>{assessmentDate}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Completion</Text>
            <Text style={styles.metricValue}>{completionPercentage}%</Text>
          </View>
        </View>

        {/* Brand accent bar */}
        <View style={styles.accentBar} />

        {/* Additional brand info */}
        {branding?.websiteUrl && (
          <Text style={[styles.footerText, { marginTop: 20, fontSize: 11 }]}>
            {branding.websiteUrl}
          </Text>
        )}
      </View>

      {/* Confidential Notice */}
      <View style={styles.confidential}>
        <Text>
          CONFIDENTIAL: This report contains sensitive family governance information and is intended solely for the assessed family.
          Distribution outside the family without written consent from {brandDisplayName} is prohibited.
        </Text>
      </View>

      {/* Branded Footer */}
      <View style={[styles.footerTextStatic, styles.brandedFooter]}>
        <Text style={{ color: 'white', fontSize: 10 }}>
          {brandDisplayName} - Confidential Risk Assessment Report
        </Text>
        {branding?.supportEmail && (
          <Text style={{ color: 'white', fontSize: 9, marginTop: 2 }}>
            Contact: {branding.supportEmail}
          </Text>
        )}
      </View>
    </Page>
  );
}

/**
 * Backward compatible version that accepts legacy AdvisorBranding interface
 */
interface LegacyAdvisorBranding {
  firmName?: string;
  logoUrl?: string;
}

interface LegacyReportCoverProps {
  assessmentDate: string;
  completionPercentage: number;
  overallScore: number;
  riskLevel: string;
  advisorBranding?: LegacyAdvisorBranding;
}

export function BrandedReportCover(props: LegacyReportCoverProps) {
  // Convert legacy branding to new format
  const enhancedBranding: AdvisorBrandingData | undefined = props.advisorBranding ? {
    brandName: props.advisorBranding.firmName,
    logoUrl: props.advisorBranding.logoUrl,
    advisorFirmName: props.advisorBranding.firmName,
    brandingEnabled: true,
    customDomainEnabled: false,
  } : undefined;

  return (
    <EnhancedReportCover
      assessmentDate={props.assessmentDate}
      completionPercentage={props.completionPercentage}
      overallScore={props.overallScore}
      riskLevel={props.riskLevel}
      branding={enhancedBranding}
    />
  );
}

export default EnhancedReportCover;