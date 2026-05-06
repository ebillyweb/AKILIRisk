import { z } from 'zod';

// Constants matching enum values (lowercase for forms, uppercase for DB)
export const familyRelationship = ['spouse', 'child', 'parent', 'sibling', 'grandchild', 'grandparent', 'other'] as const;
export const governanceRole = ['decision_maker', 'advisor', 'successor', 'beneficiary', 'trustee', 'executor', 'other'] as const;

// Zod schema for creating household members
export const householdMemberSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100, 'Full name must be 100 characters or less'),
  age: z.number().int().min(0).max(150).optional(),
  occupation: z.string().max(100, 'Occupation must be 100 characters or less').optional(),
  phone: z.string().max(20, 'Phone number must be 20 characters or less').optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'GRANDCHILD', 'GRANDPARENT', 'OTHER']),
  governanceRoles: z.array(z.enum(['DECISION_MAKER', 'ADVISOR', 'SUCCESSOR', 'BENEFICIARY', 'TRUSTEE', 'EXECUTOR', 'OTHER'])),
  isResident: z.boolean(),
  notes: z.string().max(500, 'Notes must be 500 characters or less').optional(),
  shareNameAndContactWithAdvisor: z.boolean(),
});

// Schema for updating household members (partial except for required fields)
export const updateHouseholdMemberSchema = householdMemberSchema.partial().required({
  fullName: true,
  relationship: true
});

// Type inference
export type HouseholdMemberFormData = z.infer<typeof householdMemberSchema>;

// Human-readable labels for relationships
export const RELATIONSHIP_LABELS: Record<string, string> = {
  SPOUSE: 'Spouse',
  CHILD: 'Child',
  PARENT: 'Parent',
  SIBLING: 'Sibling',
  GRANDCHILD: 'Grandchild',
  GRANDPARENT: 'Grandparent',
  OTHER: 'Other',
};

// Human-readable labels for governance roles
export const GOVERNANCE_ROLE_LABELS: Record<string, string> = {
  DECISION_MAKER: 'Decision Maker',
  ADVISOR: 'Advisor',
  SUCCESSOR: 'Successor',
  BENEFICIARY: 'Beneficiary',
  TRUSTEE: 'Trustee',
  EXECUTOR: 'Executor',
  OTHER: 'Other',
};

// Advisor profile personal details (name, phone, job title)
export const advisorPersonalDetailsSchema = z.object({
  firstName: z.string().max(80, 'First name must be 80 characters or less').optional().or(z.literal('')),
  lastName: z.string().max(80, 'Last name must be 80 characters or less').optional().or(z.literal('')),
  phone: z.string().max(30, 'Phone must be 30 characters or less').optional().or(z.literal('')),
  jobTitle: z.string().max(100, 'Job title must be 100 characters or less').optional().or(z.literal('')),
});
export type AdvisorPersonalDetailsFormData = z.infer<typeof advisorPersonalDetailsSchema>;

// Client profile personal details.
// Round-11 commit 2.1 (BRD §5.1 amendment): contact + address + DOB
// fields dropped per the "minimization by omission" strategy. The
// settings form is reduced to firstName/lastName until the round-11
// `firstName/lastName → name` consolidation lands; at that point this
// schema becomes a stub or is removed entirely.
export const clientPersonalDetailsSchema = z.object({
  firstName: z.string().max(80, 'First name must be 80 characters or less').optional().or(z.literal('')),
  lastName: z.string().max(80, 'Last name must be 80 characters or less').optional().or(z.literal('')),
});
export type ClientPersonalDetailsFormData = z.infer<typeof clientPersonalDetailsSchema>;