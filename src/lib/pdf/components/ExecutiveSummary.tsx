import { Page, Text, View } from '@react-pdf/renderer'
import { styles } from '../styles'
import { PageFooter } from './PageFooter'
import { DraftWatermark } from './DraftWatermark'

interface ExecutiveSummaryProps {
  score: number
  riskLevel: string
  categoryCount: number
  missingControlsCount: number
  companyName?: string
  /** §4.5 commit 3: see DraftWatermark. */
  draft?: boolean
}

export function ExecutiveSummary({
  score,
  riskLevel,
  categoryCount,
  missingControlsCount,
  companyName,
  draft,
}: ExecutiveSummaryProps) {
  const getRiskInterpretation = (level: string) => {
    switch (level) {
      case 'LOW':
        return 'Your family has established strong governance foundations with minimal risk exposures. The assessment indicates robust controls across most critical areas, providing a solid framework for family wealth preservation and harmony.'
      case 'MEDIUM':
        return 'Your family demonstrates good governance practices with some areas requiring attention. While foundational structures exist, addressing identified gaps will strengthen your family\'s resilience and reduce potential conflict risks.'
      case 'HIGH':
        return 'Your family\'s governance structures present elevated risks that require prompt attention. Several critical areas lack adequate controls, potentially exposing the family to wealth erosion, decision-making conflicts, and relationship strain.'
      case 'CRITICAL':
        return 'Your family faces significant governance risks that demand immediate action. The absence of essential controls across multiple areas creates substantial vulnerability to wealth destruction, family conflicts, and legacy preservation failures.'
      default:
        return 'Assessment results indicate varying governance maturity across different areas of family wealth management and decision-making structures.'
    }
  }

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>Executive Summary</Text>

      <View style={styles.section}>
        <Text style={styles.paragraph}>
          {getRiskInterpretation(riskLevel)}
        </Text>

        <Text style={styles.paragraph}>
          This comprehensive assessment evaluated {categoryCount} critical areas of family governance,
          identifying {missingControlsCount} specific recommendations for improvement.
          The overall governance maturity score of {score.toFixed(1)} out of 10 reflects the current
          state of your family's risk management framework.
        </Text>
      </View>

      <Text style={styles.subheader}>Key Assessment Metrics</Text>

      <View style={styles.metricGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Overall Score</Text>
          <Text style={styles.metricValue}>{score.toFixed(1)}/10</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Risk Level</Text>
          <Text style={styles.metricValue}>{riskLevel}</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Categories Assessed</Text>
          <Text style={styles.metricValue}>{categoryCount}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Recommendations</Text>
          <Text style={styles.metricValue}>{missingControlsCount}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subheader}>Risk Level Interpretation</Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>LOW RISK (8.0-10.0):</Text> Mature governance with comprehensive controls.
          Family demonstrates sophisticated understanding of wealth preservation and conflict prevention.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>MEDIUM RISK (6.0-7.9):</Text> Solid foundations with targeted improvement opportunities.
          Most essential controls exist but some gaps require attention to prevent future issues.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>HIGH RISK (4.0-5.9):</Text> Significant vulnerabilities requiring prompt action.
          Missing controls across multiple areas create substantial family and wealth risks.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>CRITICAL RISK (0.0-3.9):</Text> Immediate intervention required.
          Fundamental governance gaps threaten family harmony and wealth preservation.
        </Text>
      </View>

      <PageFooter companyName={companyName} />
      {draft ? <DraftWatermark /> : null}
    </Page>
  )
}