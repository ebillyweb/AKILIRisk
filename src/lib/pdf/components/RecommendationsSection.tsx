import { Page, Text, View } from '@react-pdf/renderer'
import { styles } from '../styles'
import { PageFooter } from './PageFooter'
import { DraftWatermark } from './DraftWatermark'

interface MissingControl {
  category: string
  subcategory: string
  description: string
  recommendation: string
  severity: 'high' | 'medium' | 'low'
  /** §4.5 commit 1: when present, rendered as a callout below the
   *  recommendation. Sourced from `AssessmentRecommendation.advisorNotes`
   *  (per-assessment, advisor-authored). Optional so the legacy
   *  `pillarScore.missingControls` fallback path still type-checks. */
  advisorNotes?: string
}

interface RecommendationsSectionProps {
  missingControls: MissingControl[]
  pillarNarratives?: string[]
  riskLevel?: string
  companyName?: string
  /** §4.5 commit 3: see DraftWatermark. */
  draft?: boolean
}

export function RecommendationsSection({
  missingControls,
  pillarNarratives = [],
  riskLevel = "medium",
  companyName,
  draft,
}: RecommendationsSectionProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return '#dc2626'
      case 'medium':
        return '#f59e0b'
      case 'low':
        return '#10b981'
      default:
        return '#6b7280'
    }
  }

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'High Priority'
      case 'medium':
        return 'Medium Priority'
      case 'low':
        return 'Low Priority'
      default:
        return 'Priority'
    }
  }

  if (missingControls.length === 0) {
    if (pillarNarratives.length > 0) {
      return null
    }

    const isLowRisk = riskLevel.toLowerCase() === "low"

    return (
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Recommendations</Text>

        <View style={styles.section}>
          <Text style={styles.subheader}>
            {isLowRisk ? "No Critical Gaps Identified" : "No Itemized Gaps Listed"}
          </Text>
          <Text style={styles.paragraph}>
            {isLowRisk
              ? "Congratulations! Your assessment indicates strong controls across the evaluated areas. While there are no critical gaps requiring immediate attention, consider the following best practices for maintaining your governance excellence:"
              : "No individual remediation items were listed for this pillar score. Review the pillar summary and category breakdown for context on overall maturity."}
          </Text>

          {isLowRisk ? (
            <>
              <Text style={[styles.paragraph, { marginLeft: 20 }]}>
                • Conduct annual governance reviews to ensure controls remain effective
              </Text>
              <Text style={[styles.paragraph, { marginLeft: 20 }]}>
                • Stay informed of regulatory changes affecting family wealth structures
              </Text>
              <Text style={[styles.paragraph, { marginLeft: 20 }]}>
                • Consider periodic updates to family policies as circumstances evolve
              </Text>
              <Text style={[styles.paragraph, { marginLeft: 20 }]}>
                • Engage family members in ongoing governance education
              </Text>
            </>
          ) : null}
        </View>

        <PageFooter companyName={companyName} />
        {draft ? <DraftWatermark /> : null}
      </Page>
    )
  }

  // Group recommendations by severity
  const highPriority = missingControls.filter(c => c.severity === 'high')
  const mediumPriority = missingControls.filter(c => c.severity === 'medium')
  const lowPriority = missingControls.filter(c => c.severity === 'low')
  const orderedControls = [...highPriority, ...mediumPriority, ...lowPriority]

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>Recommendations</Text>

      <Text style={styles.paragraph}>
        The following recommendations address identified governance gaps in order of priority.
        Implementing these controls will strengthen your family's risk management framework
        and improve overall governance maturity.
      </Text>

      {orderedControls.map((control, index) => (
        <View key={index} style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.subheader, { marginBottom: 0, marginRight: 12 }]}>
              {index + 1}.
            </Text>
            <View
              style={{
                backgroundColor: getSeverityColor(control.severity),
                color: 'white',
                padding: '4 8',
                fontSize: 9,
                fontWeight: 'bold',
              }}
            >
              <Text>{getSeverityLabel(control.severity)}</Text>
            </View>
          </View>

          <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>
            {control.category} - {control.subcategory}
          </Text>

          <Text style={[styles.paragraph, { marginBottom: 8 }]}>
            <Text style={{ fontWeight: 'bold' }}>Issue: </Text>
            {control.description}
          </Text>

          <Text style={styles.paragraph}>
            <Text style={{ fontWeight: 'bold' }}>Recommendation: </Text>
            {control.recommendation}
          </Text>

          {/* §4.5 commit 1: advisor commentary on this specific recommendation,
              when the advisor has authored anything in
              `AssessmentRecommendation.advisorNotes`. Indent + left rule so it
              reads as the advisor's voice rather than baseline rule output. */}
          {control.advisorNotes && control.advisorNotes.trim().length > 0 ? (
            <View
              style={{
                marginTop: 6,
                marginLeft: 12,
                paddingLeft: 8,
                borderLeftWidth: 2,
                borderLeftColor: '#94a3b8',
                borderLeftStyle: 'solid',
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: 'bold',
                  color: '#475569',
                  marginBottom: 2,
                }}
              >
                Advisor Notes
              </Text>
              <Text style={[styles.paragraph, { fontSize: 10, marginBottom: 0 }]}>
                {control.advisorNotes}
              </Text>
            </View>
          ) : null}
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.subheader}>Implementation Priority</Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: 'bold', color: '#dc2626' }}>High Priority:</Text> Address within 30 days.
          These gaps present immediate risks to family governance and wealth preservation.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: 'bold', color: '#f59e0b' }}>Medium Priority:</Text> Address within 90 days.
          Important controls that strengthen governance but are not immediately critical.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: 'bold', color: '#10b981' }}>Low Priority:</Text> Address within 12 months.
          Best practice enhancements that provide additional governance sophistication.
        </Text>
      </View>

      <PageFooter companyName={companyName} />
      {draft ? <DraftWatermark /> : null}
    </Page>
  )
}