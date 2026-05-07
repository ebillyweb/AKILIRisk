import { Page, Text, View, Image } from '@react-pdf/renderer'
import { styles } from '../styles'
import { PageFooter } from './PageFooter'
import { paletteForRiskLevel } from '@/lib/assessment/risk-color-palette'
import { DraftWatermark } from './DraftWatermark'

interface AdvisorBranding {
  firmName?: string
  logoUrl?: string
}

interface ReportCoverProps {
  assessmentDate: string
  completionPercentage: number
  overallScore: number
  riskLevel: string
  advisorBranding?: AdvisorBranding
  /** §4.5 commit 3: stamp a diagonal "DRAFT — NOT PUBLISHED" overlay
   *  when this page is rendered from a DRAFT Report or the legacy
   *  no-PUBLISHED-yet preview path. */
  draft?: boolean
}

export function ReportCover({
  assessmentDate,
  completionPercentage,
  overallScore,
  riskLevel,
  advisorBranding,
  draft,
}: ReportCoverProps) {
  // Round-10 / B1: derive cover badge color from canonical RISK_LEVEL_PALETTE
  // (`src/lib/assessment/risk-color-palette.ts`) so the cover badge and the
  // Risk-by-Domain heat-map page (rendered later in the same document) use
  // matching colors. Pre-round-10 this was an inline switch with red HIGH
  // (#ef4444). The canonical palette uses orange (#f97316) for HIGH so HIGH
  // is visually distinct from CRITICAL (red) on the cover.
  const getRiskColor = (level: string): string =>
    paletteForRiskLevel(level).hex

  return (
    <Page size="A4" style={styles.page}>
      <View style={{ textAlign: 'center', marginTop: 100 }}>
        {advisorBranding?.logoUrl && (
          <Image
            src={advisorBranding.logoUrl}
            style={{ maxHeight: 60, marginBottom: 20, alignSelf: 'center' }}
          />
        )}
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 40 }}>
          {advisorBranding?.firmName || "Akili Risk"}
        </Text>

        <Text style={styles.coverTitle}>
          {"Family Governance\nAssessment Report"}
        </Text>

        <Text style={styles.coverSubtitle}>
          Confidential Risk Analysis & Recommendations
        </Text>

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
      </View>

      <View style={styles.confidential}>
        <Text>
          CONFIDENTIAL: This report contains sensitive family governance information and is intended solely for the assessed family.
          Distribution outside the family without written consent from {advisorBranding?.firmName || "Akili Risk"} is prohibited.
        </Text>
      </View>

      <PageFooter companyName={advisorBranding?.firmName} />
      {draft ? <DraftWatermark /> : null}
    </Page>
  )
}