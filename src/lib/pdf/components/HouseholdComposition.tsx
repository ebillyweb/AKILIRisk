import { Page, Text, View } from '@react-pdf/renderer'
import { styles } from '../styles'
import { PageFooter } from './PageFooter'

/**
 * Round-11 commit 2.2 (BRD §5.1 amendment): demographic-only shape.
 * fullName / age columns dropped from `HouseholdMember` upstream;
 * the report now renders the auto-assigned label (Member A / Member B
 * / …) and derives an approximate age from `birthYear` at render time.
 */
interface HouseholdMember {
  displayLabel: string
  relationship: string
  birthYear: number | null
  sex: string | null
  governanceRoles: string[]
  isResident: boolean
}

interface HouseholdCompositionProps {
  members: HouseholdMember[]
  companyName?: string
}

const SEX_LABELS: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
}

export function HouseholdComposition({ members, companyName }: HouseholdCompositionProps) {
  const currentYear = new Date().getUTCFullYear()

  const formatRelationship = (relationship: string) => {
    return relationship
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const formatGovernanceRoles = (roles: string[]) => {
    if (roles.length === 0) return 'None'
    return roles
      .map((role) =>
        role
          .toLowerCase()
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
      )
      .join(', ')
  }

  const formatAge = (birthYear: number | null) => {
    if (typeof birthYear !== 'number') return 'N/A'
    return `~${Math.max(0, currentYear - birthYear)}`
  }

  const formatSex = (sex: string | null) => {
    if (!sex) return '—'
    return SEX_LABELS[sex] ?? sex
  }

  const formatStatus = (isResident: boolean) => {
    return isResident ? 'Resident' : 'Extended Family'
  }

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>Household Composition</Text>

      <Text style={styles.paragraph}>
        Demographic structure of the household — labels (Member A, Member B…), relationships,
        approximate age, sex, governance roles, and residence. Personal names and contact details
        are not collected (BRD §5.1 amendment); structure alone is sufficient for governance
        recommendations and succession planning.
      </Text>

      <View style={styles.householdTable}>
        {/* Table Header */}
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCol, { flex: 1.2 }]}>Member</Text>
          <Text style={[styles.tableCol, { flex: 1.5 }]}>Relationship</Text>
          <Text style={[styles.tableCol, { flex: 0.8 }]}>Age</Text>
          <Text style={[styles.tableCol, { flex: 1.0 }]}>Sex</Text>
          <Text style={[styles.tableCol, { flex: 2 }]}>Governance Roles</Text>
          <Text style={[styles.tableCol, { flex: 1.2 }]}>Status</Text>
        </View>

        {/* Table Rows */}
        {members.map((member, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={[styles.tableCol, { flex: 1.2 }]}>{member.displayLabel}</Text>
            <Text style={[styles.tableCol, { flex: 1.5 }]}>
              {formatRelationship(member.relationship)}
            </Text>
            <Text style={[styles.tableCol, { flex: 0.8 }]}>{formatAge(member.birthYear)}</Text>
            <Text style={[styles.tableCol, { flex: 1.0 }]}>{formatSex(member.sex)}</Text>
            <Text style={[styles.tableCol, { flex: 2 }]}>
              {formatGovernanceRoles(member.governanceRoles)}
            </Text>
            <Text style={[styles.tableCol, { flex: 1.2 }]}>{formatStatus(member.isResident)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>Total Household Members:</Text> {members.length}
        </Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>Residents:</Text>{' '}
          {members.filter((m) => m.isResident).length}
        </Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>Extended Family:</Text>{' '}
          {members.filter((m) => !m.isResident).length}
        </Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>Members with Governance Roles:</Text>{' '}
          {members.filter((m) => m.governanceRoles.length > 0).length}
        </Text>
      </View>

      <PageFooter companyName={companyName} />
    </Page>
  )
}
