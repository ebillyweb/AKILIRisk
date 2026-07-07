import type { CadenceFrequency } from "@prisma/client";

// ---------------------------------------------------------------------------
// Cadence status (matches UI-SPEC cadence states)
// ---------------------------------------------------------------------------

export type CadenceStatus =
  | "on_track"
  | "due_soon"
  | "overdue"
  | "system_recommended";

// ---------------------------------------------------------------------------
// Cadence info (returned by cadence queries)
// ---------------------------------------------------------------------------

export type CadenceInfo = {
  id: string;
  clientId: string;
  frequency: CadenceFrequency;
  nextDueDate: Date;
  status: CadenceStatus;
  daysUntilDue: number;
  isOverridden: boolean;
  systemRecommended: boolean;
  systemRecommendationReason: string | null;
  lastAssessmentId: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Due soon threshold: cadences within 14 days are "due_soon" */
export const DUE_SOON_THRESHOLD_DAYS = 14;

/** Map from CadenceFrequency enum to number of days */
export const CADENCE_FREQUENCY_DAYS: Record<CadenceFrequency, number> = {
  QUARTERLY: 90,
  SEMI_ANNUAL: 180,
  ANNUAL: 365,
};

/** Dedup window: suppress reminders if one was sent within 7 days */
export const REMINDER_DEDUP_DAYS = 7;
