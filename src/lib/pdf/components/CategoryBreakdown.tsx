import { Page, Text, View } from '@react-pdf/renderer'
import { styles } from '../styles'
import { PageFooter } from './PageFooter'
import { DraftWatermark } from './DraftWatermark'

interface CategoryScore {
  name: string
  score: number
  maxScore: number
  subcategoryCount: number
}

interface CategoryBreakdownProps {
  breakdown: CategoryScore[]
  companyName?: string
  /** §4.5 commit 3: see DraftWatermark. */
  draft?: boolean
}

export function CategoryBreakdown({ breakdown, companyName, draft }: CategoryBreakdownProps) {
  const columnStyles = {
    row: {
      flexDirection: 'row' as const,
      width: '100%',
      alignItems: 'stretch' as const,
    },
    categoryCol: {
      width: '50%',
      borderStyle: 'solid' as const,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderLeftWidth: 0,
      borderTopWidth: 0,
      padding: 8,
    },
    scoreCol: {
      width: '20%',
      borderStyle: 'solid' as const,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderLeftWidth: 0,
      borderTopWidth: 0,
      padding: 8,
    },
    progressCol: {
      width: '30%',
      borderStyle: 'solid' as const,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderLeftWidth: 0,
      borderTopWidth: 0,
      padding: 8,
    },
    headerCell: {
      backgroundColor: '#f9fafb',
      fontWeight: 'bold' as const,
    },
  }

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100
    if (percentage >= 75) return '#10b981' // green
    if (percentage >= 50) return '#f59e0b' // amber
    if (percentage >= 25) return '#f97316' // orange
    return '#ef4444' // red
  }

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>Category Score Breakdown</Text>

      <Text style={styles.paragraph}>
        This section provides detailed scoring for each governance category assessed.
        Scores reflect the maturity and effectiveness of controls within each area.
      </Text>

      <View style={styles.table}>
        {/* Table Header */}
        <View style={columnStyles.row}>
          <View style={[columnStyles.categoryCol, columnStyles.headerCell]}>
            <Text style={{ fontWeight: 'bold' }}>Category</Text>
          </View>
          <View style={[columnStyles.scoreCol, columnStyles.headerCell]}>
            <Text style={{ fontWeight: 'bold' }}>Score</Text>
          </View>
          <View style={[columnStyles.progressCol, columnStyles.headerCell]}>
            <Text style={{ fontWeight: 'bold' }}>Progress</Text>
          </View>
        </View>

        {/* Table Rows */}
        {breakdown.map((category, index) => {
          const percentage = (category.score / category.maxScore) * 100
          const scoreColor = getScoreColor(category.score, category.maxScore)

          return (
            <View key={index} style={columnStyles.row}>
              <View style={columnStyles.categoryCol}>
                <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>
                  {category.name}
                </Text>
                <Text style={{ fontSize: 9, color: '#6b7280' }}>
                  {category.subcategoryCount} subcategories assessed
                </Text>
              </View>
              <View style={columnStyles.scoreCol}>
                <Text style={{ fontWeight: 'bold', color: scoreColor }}>
                  {category.score.toFixed(1)}/{category.maxScore}
                </Text>
                <Text style={{ fontSize: 9, color: '#6b7280' }}>
                  ({percentage.toFixed(0)}%)
                </Text>
              </View>
              <View style={columnStyles.progressCol}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${percentage}%`,
                        backgroundColor: scoreColor,
                      },
                    ]}
                  />
                </View>
                <Text style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>
                  {percentage >= 75
                    ? 'Strong'
                    : percentage >= 50
                    ? 'Moderate'
                    : percentage >= 25
                    ? 'Weak'
                    : 'Critical'}
                </Text>
              </View>
            </View>
          )
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.subheader}>Scoring Methodology</Text>
        <Text style={styles.paragraph}>
          Category scores are calculated using a weighted average of subcategory assessments.
          Each question contributes to its subcategory score, which then rolls up to the category level
          based on relative importance and risk impact. The 0-10 scale represents governance maturity,
          where 10 indicates best-practice controls and 0 represents significant gaps.
        </Text>
      </View>

      <PageFooter companyName={companyName} />
      {draft ? <DraftWatermark /> : null}
    </Page>
  )
}