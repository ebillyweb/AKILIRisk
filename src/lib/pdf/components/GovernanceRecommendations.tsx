import { Page, Text, View } from '@react-pdf/renderer'
import { styles } from '../styles'
import { PageFooter } from './PageFooter'
import { DraftWatermark } from './DraftWatermark'

// Round-11 commit 2.2 (BRD §5.1 amendment): displayLabel replaces
// fullName upstream. Pre-round-11 governance recs called out members
// by name ("Current Trustee(s): Jane Smith"); the report now references
// auto-generated labels ("Current Trustee(s): Member A") because
// HouseholdMember no longer carries names.
interface HouseholdMember {
  displayLabel: string
  governanceRoles: string[]
  relationship: string
}

interface MissingControl {
  category: string
  recommendation: string
  severity: string
}

interface GovernanceRecommendationsProps {
  members: HouseholdMember[]
  missingControls: MissingControl[]
  companyName?: string
  /** §4.5 commit 3: see DraftWatermark. */
  draft?: boolean
}

export function GovernanceRecommendations({
  members,
  missingControls,
  companyName,
  draft,
}: GovernanceRecommendationsProps) {
  const formatRoleName = (role: string) => {
    return role
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const getRoleMembers = (targetRole: string) => {
    return members.filter((member) => member.governanceRoles.includes(targetRole))
  }

  const getRoleRecommendations = (role: string, missingControls: MissingControl[]) => {
    const roleCategories: Record<string, string[]> = {
      DECISION_MAKER: ['Decision Making', 'Voting', 'Authority', 'Quorum', 'Leadership'],
      SUCCESSOR: ['Succession', 'Mentorship', 'Development', 'Transition', 'Training'],
      TRUSTEE: ['Trust', 'Fiduciary', 'Investment', 'Distribution', 'Oversight'],
      ADVISOR: ['Advisory', 'Board', 'Meeting', 'Counsel', 'Guidance'],
      BENEFICIARY: ['Distribution', 'Rights', 'Benefits', 'Entitlement'],
      EXECUTOR: ['Estate', 'Execution', 'Document', 'Administration', 'Settlement'],
    }

    const categories = roleCategories[role] || []
    const relatedControls = missingControls.filter((control) =>
      categories.some((cat) => control.category.toLowerCase().includes(cat.toLowerCase()))
    )

    return relatedControls.map((control) => control.recommendation)
  }

  const getGenericRecommendations = (role: string) => {
    const recommendations: Record<string, string[]> = {
      DECISION_MAKER: [
        'Establish clear decision-making authority and voting procedures',
        'Define quorum requirements for major family decisions',
        'Document decision-making processes and approval hierarchies',
        'Implement regular family council meetings with structured agendas',
      ],
      SUCCESSOR: [
        'Develop comprehensive succession planning documentation',
        'Establish mentorship programs to prepare next-generation leaders',
        'Create capability development plans with measurable milestones',
        'Implement gradual transition of responsibilities over time',
      ],
      TRUSTEE: [
        'Document fiduciary responsibilities and duties clearly',
        'Establish investment committee structure and oversight procedures',
        'Implement regular trust governance reviews and reporting',
        'Define distribution policies and beneficiary communication protocols',
      ],
      ADVISOR: [
        'Structure advisory board with clear roles and responsibilities',
        'Establish regular meeting cadence and structured agenda formats',
        'Document advisory input processes and decision integration',
        'Define advisor compensation and performance evaluation criteria',
      ],
      BENEFICIARY: [
        'Clarify distribution policies and beneficiary rights',
        'Establish transparent communication protocols with trustees',
        'Document procedures for beneficiary requests and approvals',
        'Implement beneficiary education and governance training programs',
      ],
      EXECUTOR: [
        'Maintain current and accessible estate documentation',
        'Establish document management and secure storage systems',
        'Define estate execution procedures and timelines',
        'Implement regular review and updates of estate plans',
      ],
    }

    return recommendations[role] || []
  }

  const rolesInHousehold = Array.from(
    new Set(members.flatMap((member) => member.governanceRoles))
  )

  const hasGovernanceRoles = rolesInHousehold.length > 0

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>Family Governance Recommendations</Text>

      <Text style={styles.paragraph}>
        These personalized recommendations are based on your household composition and the governance
        roles currently assigned to family members. Implementing these suggestions will strengthen
        your family's governance framework and support effective wealth stewardship across generations.
      </Text>

      {!hasGovernanceRoles ? (
        <View style={styles.section}>
          <Text style={styles.subheader}>Establish Governance Role Assignments</Text>
          <Text style={styles.paragraph}>
            Your household currently has no assigned governance roles. Consider establishing formal
            governance roles to provide structure, accountability, and clarity in family decision-making.
            Recommended first steps:
          </Text>
          <Text style={[styles.paragraph, { marginLeft: 20 }]}>
            • Identify primary decision-makers for major family and financial decisions
          </Text>
          <Text style={[styles.paragraph, { marginLeft: 20 }]}>
            • Designate successors to ensure continuity of leadership
          </Text>
          <Text style={[styles.paragraph, { marginLeft: 20 }]}>
            • Assign trustee responsibilities for any existing trust structures
          </Text>
          <Text style={[styles.paragraph, { marginLeft: 20 }]}>
            • Consider advisory roles for family members with relevant expertise
          </Text>
        </View>
      ) : (
        rolesInHousehold.map((role, index) => {
          const roleMembers = getRoleMembers(role)
          const specificRecommendations = getRoleRecommendations(role, missingControls)
          const genericRecommendations = getGenericRecommendations(role)
          const allRecommendations = [...specificRecommendations, ...genericRecommendations]

          return (
            <View key={index} style={styles.roleSection}>
              <Text style={styles.subheader}>{formatRoleName(role)}</Text>

              <View style={styles.roleMemberList}>
                <Text style={styles.paragraph}>
                  <Text style={{ fontWeight: 'bold' }}>Current {formatRoleName(role)}(s):</Text>{' '}
                  {roleMembers.map((member) => member.displayLabel).join(', ')}
                </Text>
              </View>

              {allRecommendations.slice(0, 4).map((recommendation, recIndex) => (
                <Text key={recIndex} style={[styles.paragraph, { marginLeft: 20 }]}>
                  • {recommendation}
                </Text>
              ))}

              {roleMembers.length > 1 && (
                <Text style={styles.paragraph}>
                  <Text style={{ fontWeight: 'bold' }}>Note:</Text> With multiple{' '}
                  {formatRoleName(role).toLowerCase()}s, ensure clear coordination protocols and
                  defined areas of responsibility to avoid conflicts.
                </Text>
              )}
            </View>
          )
        })
      )}

      <View style={styles.section}>
        <Text style={styles.subheader}>Implementation Priority</Text>
        <Text style={styles.paragraph}>
          Start with establishing or refining the roles with the most immediate impact on family
          decision-making and wealth preservation. Consider engaging professional advisors to assist
          with complex governance structures and ensure legal compliance.
        </Text>
      </View>

      <PageFooter companyName={companyName} />
      {draft ? <DraftWatermark /> : null}
    </Page>
  )
}