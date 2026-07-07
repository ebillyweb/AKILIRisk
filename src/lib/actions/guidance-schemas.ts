/**
 * Zod validation schemas for the three-role recommendation server actions:
 * advisor guidance review, enterprise overlay CRUD, and client task status.
 *
 * @see guidance-actions.ts
 * @see enterprise-solution-actions.ts
 * @see client-action-plan-actions.ts
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Advisor schemas
// ---------------------------------------------------------------------------

export const includeSchema = z.object({
  recommendationIds: z.array(z.string().cuid()).min(1).max(100),
});
export type IncludeInput = z.infer<typeof includeSchema>;

export const deferSchema = z.object({
  recommendationId: z.string().cuid(),
  reason: z.string().min(1).max(500),
  revisitDate: z.string().datetime().optional(),
  triggerEvent: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});
export type DeferInput = z.infer<typeof deferSchema>;

export const bulkDeferSchema = z.object({
  recommendationIds: z.array(z.string().cuid()).min(1).max(100),
  reason: z.string().min(1).max(500),
  revisitDate: z.string().datetime().optional(),
});
export type BulkDeferInput = z.infer<typeof bulkDeferSchema>;

export const hideFromClientSchema = z.object({
  recommendationId: z.string().cuid(),
  hidden: z.boolean(),
});
export type HideFromClientInput = z.infer<typeof hideFromClientSchema>;

export const adjustPrioritySchema = z.object({
  recommendationId: z.string().cuid(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
});
export type AdjustPriorityInput = z.infer<typeof adjustPrioritySchema>;

export const updateNotesSchema = z.object({
  recommendationId: z.string().cuid(),
  notes: z.string().max(5000),
});
export type UpdateNotesInput = z.infer<typeof updateNotesSchema>;

export const validationStatusSchema = z.object({
  recommendationId: z.string().cuid(),
  status: z.enum(["PENDING_REVIEW", "VERIFIED", "NEEDS_FOLLOWUP"]),
});
export type ValidationStatusInput = z.infer<typeof validationStatusSchema>;

export const updateTimeHorizonSchema = z.object({
  recommendationId: z.string().cuid(),
  timeHorizon: z.enum(["immediate", "strategic", "ongoing"]),
});
export type UpdateTimeHorizonInput = z.infer<typeof updateTimeHorizonSchema>;

export const updateRolesSchema = z.object({
  recommendationId: z.string().cuid(),
  roles: z.array(z.string().max(100)).max(10),
});
export type UpdateRolesInput = z.infer<typeof updateRolesSchema>;

export const updateAssigneesSchema = z.object({
  recommendationId: z.string().cuid(),
  assignees: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        org: z.string().optional(),
      })
    )
    .max(20),
});
export type UpdateAssigneesInput = z.infer<typeof updateAssigneesSchema>;

// ---------------------------------------------------------------------------
// Milestone management (Phase 23)
// ---------------------------------------------------------------------------

export const milestoneBlockSchema = z.object({
  milestoneId: z.string().cuid(),
  reason: z.string().min(10).max(500),
});
export type MilestoneBlockInput = z.infer<typeof milestoneBlockSchema>;

export const milestoneDeferSchema = z.object({
  milestoneId: z.string().cuid(),
  reason: z.string().min(1).max(500),
  revisitDate: z.string().datetime().optional(),
});
export type MilestoneDeferInput = z.infer<typeof milestoneDeferSchema>;

export const publishActionPlanSchema = z.object({
  assessmentId: z.string().cuid(),
});
export type PublishActionPlanInput = z.infer<typeof publishActionPlanSchema>;

export const milestoneStatusSchema = z.object({
  milestoneId: z.string().cuid(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "SKIPPED"]),
});
export type MilestoneStatusInput = z.infer<typeof milestoneStatusSchema>;

// ---------------------------------------------------------------------------
// Enterprise schema
// ---------------------------------------------------------------------------

export const enterpriseOverlaySchema = z.object({
  serviceRecommendationId: z.string().cuid(),
  isRequired: z.boolean().optional(),
  priorityAdjustment: z.number().int().min(-10).max(10).optional(),
  complianceDisclosures: z.string().max(5000).optional(),
  customGuidance: z.string().max(5000).optional(),
  internalLinks: z
    .array(
      z.object({
        url: z.string().url(),
        label: z.string(),
      })
    )
    .max(20)
    .optional(),
  costOverride: z.string().max(200).optional(),
  timeframeOverride: z.string().max(200).optional(),
  providerOverride: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  additionalPlaybook: z
    .object({
      steps: z
        .array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            estimatedDuration: z.string().optional(),
            sortOrder: z.number().int(),
          })
        )
        .max(20),
    })
    .optional(),
  isActive: z.boolean().optional(),
});
export type EnterpriseOverlayInput = z.infer<typeof enterpriseOverlaySchema>;

// ---------------------------------------------------------------------------
// Client schema
// ---------------------------------------------------------------------------

export const taskStatusSchema = z.object({
  recommendationId: z.string().cuid(),
  taskStatus: z.enum([
    "NOT_STARTED",
    "IN_PROGRESS",
    "WAITING",
    "READY_FOR_REVIEW",
    "COMPLETED",
  ]),
});
export type TaskStatusInput = z.infer<typeof taskStatusSchema>;
