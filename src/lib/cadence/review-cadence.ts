import "server-only";

import type { CadenceFrequency } from "@prisma/client";
import { addDays, differenceInDays, subDays } from "date-fns";
import { prisma } from "@/lib/db";
import {
  type CadenceInfo,
  type CadenceStatus,
  CADENCE_FREQUENCY_DAYS,
  DUE_SOON_THRESHOLD_DAYS,
  REMINDER_DEDUP_DAYS,
} from "./cadence-types";

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Compute next due date from an assessment completion date and frequency.
 */
export function computeNextDueDate(
  completedAt: Date,
  frequency: CadenceFrequency,
): Date {
  return addDays(completedAt, CADENCE_FREQUENCY_DAYS[frequency]);
}

/**
 * Determine cadence status and days until due.
 */
export function getCadenceStatus(
  nextDueDate: Date,
  systemRecommended: boolean,
): { status: CadenceStatus; daysUntilDue: number } {
  if (systemRecommended) {
    const daysUntilDue = differenceInDays(nextDueDate, new Date());
    return { status: "system_recommended", daysUntilDue };
  }

  const daysUntilDue = differenceInDays(nextDueDate, new Date());

  if (daysUntilDue <= 0) {
    return { status: "overdue", daysUntilDue };
  }

  if (daysUntilDue <= DUE_SOON_THRESHOLD_DAYS) {
    return { status: "due_soon", daysUntilDue };
  }

  return { status: "on_track", daysUntilDue };
}

// ---------------------------------------------------------------------------
// Database queries
// ---------------------------------------------------------------------------

/**
 * Get cadence info for a specific client-advisor pair.
 */
export async function getCadenceForClient(
  clientId: string,
  advisorProfileId: string,
): Promise<CadenceInfo | null> {
  const cadence = await prisma.reviewCadence.findUnique({
    where: {
      clientId_advisorProfileId: { clientId, advisorProfileId },
    },
  });

  if (!cadence) return null;

  const { status, daysUntilDue } = getCadenceStatus(
    cadence.nextDueDate,
    cadence.systemRecommended,
  );

  return {
    id: cadence.id,
    clientId: cadence.clientId,
    frequency: cadence.frequency,
    nextDueDate: cadence.nextDueDate,
    status,
    daysUntilDue,
    isOverridden: cadence.isOverridden,
    systemRecommended: cadence.systemRecommended,
    systemRecommendationReason: cadence.systemRecommendationReason,
    lastAssessmentId: cadence.lastAssessmentId,
  };
}

/**
 * Create or update a cadence for a client-advisor pair (upsert by unique constraint).
 * Per D-08, isOverridden=true when an advisor sets the cadence manually.
 */
export async function createOrUpdateCadence(input: {
  clientId: string;
  advisorProfileId: string;
  frequency: CadenceFrequency;
  nextDueDate: Date;
  isOverridden: boolean;
}): Promise<CadenceInfo> {
  const { clientId, advisorProfileId, frequency, nextDueDate, isOverridden } =
    input;

  const cadence = await prisma.reviewCadence.upsert({
    where: {
      clientId_advisorProfileId: { clientId, advisorProfileId },
    },
    create: {
      clientId,
      advisorProfileId,
      frequency,
      nextDueDate,
      isOverridden,
    },
    update: {
      frequency,
      nextDueDate,
      isOverridden,
    },
  });

  const { status, daysUntilDue } = getCadenceStatus(
    cadence.nextDueDate,
    cadence.systemRecommended,
  );

  return {
    id: cadence.id,
    clientId: cadence.clientId,
    frequency: cadence.frequency,
    nextDueDate: cadence.nextDueDate,
    status,
    daysUntilDue,
    isOverridden: cadence.isOverridden,
    systemRecommended: cadence.systemRecommended,
    systemRecommendationReason: cadence.systemRecommendationReason,
    lastAssessmentId: cadence.lastAssessmentId,
  };
}

/**
 * Get all overdue cadences (nextDueDate < now).
 * Filters out rows where lastReminderSentAt is within 7 days (Pitfall 5 dedup).
 */
export async function getOverdueCadences() {
  const now = new Date();
  const dedupCutoff = subDays(now, REMINDER_DEDUP_DAYS);

  return prisma.reviewCadence.findMany({
    where: {
      nextDueDate: { lt: now },
      OR: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { lt: dedupCutoff } },
      ],
    },
  });
}

/**
 * Get cadences due within thresholdDays (default 14).
 * Filters by lastReminderSentAt for dedup.
 */
export async function getDueSoonCadences(
  thresholdDays: number = DUE_SOON_THRESHOLD_DAYS,
) {
  const now = new Date();
  const cutoff = addDays(now, thresholdDays);
  const dedupCutoff = subDays(now, REMINDER_DEDUP_DAYS);

  return prisma.reviewCadence.findMany({
    where: {
      nextDueDate: { gte: now, lte: cutoff },
      OR: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { lt: dedupCutoff } },
      ],
    },
  });
}

/**
 * Initialize cadence for a client after first assessment completion.
 * Loads enterprise default frequency from AdvisorEnterprise.
 */
export async function initializeCadenceForClient(
  clientId: string,
  advisorProfileId: string,
  assessmentId: string,
  assessmentCompletedAt: Date,
): Promise<CadenceInfo> {
  // Load enterprise default frequency
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      enterprise: {
        select: { defaultCadenceFrequency: true },
      },
    },
  });

  const frequency: CadenceFrequency =
    profile?.enterprise?.defaultCadenceFrequency ?? "ANNUAL";

  const nextDueDate = computeNextDueDate(assessmentCompletedAt, frequency);

  const cadence = await prisma.reviewCadence.upsert({
    where: {
      clientId_advisorProfileId: { clientId, advisorProfileId },
    },
    create: {
      clientId,
      advisorProfileId,
      frequency,
      nextDueDate,
      lastAssessmentId: assessmentId,
      isOverridden: false,
    },
    update: {
      frequency,
      nextDueDate,
      lastAssessmentId: assessmentId,
    },
  });

  const { status, daysUntilDue } = getCadenceStatus(
    cadence.nextDueDate,
    cadence.systemRecommended,
  );

  return {
    id: cadence.id,
    clientId: cadence.clientId,
    frequency: cadence.frequency,
    nextDueDate: cadence.nextDueDate,
    status,
    daysUntilDue,
    isOverridden: cadence.isOverridden,
    systemRecommended: cadence.systemRecommended,
    systemRecommendationReason: cadence.systemRecommendationReason,
    lastAssessmentId: cadence.lastAssessmentId,
  };
}
