import { z } from 'zod';

/** Roles surfaced on mobile (ADMIN is web-only per the plan). */
export const UserRole = z.enum(['USER', 'ADVISOR', 'ADMIN']);
export type UserRole = z.infer<typeof UserRole>;

export const SessionUser = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  role: UserRole.catch('USER'),
  advisorFirmName: z.string().nullable().optional(),
});
export type SessionUser = z.infer<typeof SessionUser>;

/** Response from POST /api/auth/verify (magic link) and /api/auth/verify-code. */
export const VerifyResponse = z.object({
  token: z.string(),
  user: SessionUser,
});
export type VerifyResponse = z.infer<typeof VerifyResponse>;

/** How a single intake answer was authored. */
export const ResponseMode = z.enum(['TYPE', 'VOICE']);
export type ResponseMode = z.infer<typeof ResponseMode>;

/** Where a locally-authored answer currently lives (drives the save-status pill). */
export type SyncState = 'SAVED_LOCAL' | 'QUEUED' | 'SYNCED' | 'FAILED';

/** Canonical intake status, tolerant of backend casing. */
export const IntakeStatus = z
  .enum(['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'IN_REVIEW', 'APPROVED'])
  .catch('NOT_STARTED');
export type IntakeStatus = z.infer<typeof IntakeStatus>;

export const IntakeQuestion = z.object({
  id: z.string(),
  /** Display order (0-based). */
  order: z.number(),
  pillar: z.string(),
  prompt: z.string(),
  helpText: z.string().nullable().optional(),
  /** Whether voice answers are permitted (defaults true). */
  allowVoice: z.boolean().optional().default(true),
});
export type IntakeQuestion = z.infer<typeof IntakeQuestion>;

/** GET /api/intake/script — the question set for the user's interview. */
export const IntakeScript = z.object({
  interviewId: z.string(),
  status: IntakeStatus,
  questions: z.array(IntakeQuestion),
});
export type IntakeScript = z.infer<typeof IntakeScript>;

export const TranscriptionStatus = z
  .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NONE'])
  .catch('NONE');
export type TranscriptionStatus = z.infer<typeof TranscriptionStatus>;

/** A server-side intake response (used by the advisor read view). */
export const IntakeResponse = z.object({
  questionId: z.string(),
  mode: ResponseMode.optional(),
  text: z.string().nullable().optional(),
  audioUrl: z.string().nullable().optional(),
  transcript: z.string().nullable().optional(),
  transcriptionStatus: TranscriptionStatus.optional(),
  updatedAt: z.string().optional(),
});
export type IntakeResponse = z.infer<typeof IntakeResponse>;

/** Advisor's view of an assigned client. */
export const AdvisorClient = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string(),
  intakeStatus: IntakeStatus,
  submittedAt: z.string().nullable().optional(),
  interviewId: z.string().nullable().optional(),
});
export type AdvisorClient = z.infer<typeof AdvisorClient>;
export const AdvisorClientList = z.array(AdvisorClient);

/** Advisor's read-only detail for one client's intake. */
export const ClientIntakeDetail = z.object({
  client: AdvisorClient,
  questions: z.array(IntakeQuestion),
  responses: z.array(IntakeResponse),
});
export type ClientIntakeDetail = z.infer<typeof ClientIntakeDetail>;
