import { z } from 'zod';

/** Mirrors the backend Prisma enums so the client stays in lockstep with the API. */

export const RiskLevel = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const AssessmentStatus = z.enum(['IN_PROGRESS', 'COMPLETED', 'ARCHIVED']);
export type AssessmentStatus = z.infer<typeof AssessmentStatus>;

export const UserRole = z.enum(['USER', 'ADVISOR', 'ADMIN']);
export type UserRole = z.infer<typeof UserRole>;

export const SessionUser = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  role: UserRole.catch('USER'),
  mfaEnabled: z.boolean().optional(),
  mfaVerified: z.boolean().optional(),
});
export type SessionUser = z.infer<typeof SessionUser>;

/** NextAuth `/api/auth/session` response shape. */
export const SessionResponse = z.object({
  user: SessionUser.optional(),
  expires: z.string().optional(),
});
export type SessionResponse = z.infer<typeof SessionResponse>;

export const PillarScore = z.object({
  id: z.string(),
  assessmentId: z.string(),
  pillar: z.string(),
  score: z.number(),
  riskLevel: RiskLevel,
  breakdown: z.unknown().optional(),
  missingControls: z.unknown().nullable().optional(),
  calculatedAt: z.string().optional(),
});
export type PillarScore = z.infer<typeof PillarScore>;

export const Assessment = z.object({
  id: z.string(),
  userId: z.string(),
  version: z.number().optional(),
  status: AssessmentStatus,
  currentPillar: z.string().nullable().optional(),
  currentQuestionIndex: z.number().nullable().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  updatedAt: z.string(),
  scores: z.array(PillarScore).optional(),
  _count: z.object({ responses: z.number() }).optional(),
});
export type Assessment = z.infer<typeof Assessment>;

export const AssessmentList = z.array(Assessment);
