import { z } from 'zod';
import { normalizeIncludedPillarIds } from '@/lib/assessment/included-pillars';
import { starterPillarCatalog } from '@/lib/methodology/pillar-catalog';

const VALIDATION_PILLAR_CATALOG = starterPillarCatalog();

// Schema for assigning a client to an advisor
export const assignClientSchema = z.object({
  clientId: z.string().cuid(),
  advisorId: z.string().cuid(),
});

/** Shared pillar + emphasis validation for approval and intake-waiver scope. */
function refineAssessmentScopeFields(
  data: { includedPillars: string[]; focusAreas?: string[] },
  ctx: z.RefinementCtx,
) {
  let included: string[];
  try {
    included = normalizeIncludedPillarIds(data.includedPillars, VALIDATION_PILLAR_CATALOG);
  } catch (e) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: e instanceof Error ? e.message : "Invalid risk domain selection",
      path: ["includedPillars"],
    });
    return;
  }

  if (included.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one risk domain",
      path: ["includedPillars"],
    });
  }

  if (!data.focusAreas?.length) return;

  let emphasis: string[];
  try {
    emphasis = normalizeIncludedPillarIds(data.focusAreas, VALIDATION_PILLAR_CATALOG);
  } catch (e) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: e instanceof Error ? e.message : "Invalid emphasis selection",
      path: ["focusAreas"],
    });
    return;
  }

  for (const id of emphasis) {
    if (!included.includes(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Emphasis areas must be within selected risk domains",
        path: ["focusAreas"],
      });
      break;
    }
  }
}

// Schema for approving a client's intake with assessment scope (Epic 5.11)
export const approveClientSchema = z
  .object({
    interviewId: z.string().min(1),
    includedPillars: z
      .array(z.string())
      .min(1, "Select at least one risk domain")
      .max(20, "Too many risk domains"),
    focusAreas: z.array(z.string()).max(20).optional(),
    notes: z.string().optional(),
  })
  .superRefine(refineAssessmentScopeFields);

// Schema for intake-waiver assessment scope (Epic 5.11)
export const waiverAssessmentScopeSchema = z
  .object({
    includedPillars: z
      .array(z.string())
      .min(1, "Select at least one risk domain")
      .max(20, "Too many risk domains"),
    focusAreas: z.array(z.string()).max(20).optional(),
  })
  .superRefine(refineAssessmentScopeFields);

// Schema for selecting risk areas during approval process
export const selectRiskAreasSchema = z.object({
  focusAreas: z.array(z.string()).min(1).max(20),
});

// Schema for updating approval status
export const updateApprovalStatusSchema = z.object({
  approvalId: z.string().cuid(),
  status: z.enum(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED']),
});

export type AssignClientInput = z.infer<typeof assignClientSchema>;
export type ApproveClientInput = z.infer<typeof approveClientSchema>;
export type WaiverAssessmentScopeInput = z.infer<typeof waiverAssessmentScopeSchema>;
export type SelectRiskAreasInput = z.infer<typeof selectRiskAreasSchema>;
export type UpdateApprovalStatusInput = z.infer<typeof updateApprovalStatusSchema>;
