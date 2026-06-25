/**
 * Assessment Customization Data Layer
 *
 * Database queries to fetch approved IntakeApproval for a user
 * and derive CustomizationConfig from engagement scope (not stale approval rows).
 */

import 'server-only';
import { prisma } from '@/lib/db';
import { getClientAssessmentScope } from '@/lib/client/assessment-scope';
import { getClientIntakeGateState } from '@/lib/client/intake-gate';
import {
  getCustomizationConfig,
  type CustomizationConfig,
} from '@/lib/assessment/customization';
import { getPlatformPillarCatalog } from '@/lib/methodology/cached-pillar-catalog';

/**
 * Get the most recent approved IntakeApproval for a user
 * Returns null if no approved intake exists
 */
export async function getActiveApprovalForUser(userId: string) {
  const approval = await prisma.intakeApproval.findFirst({
    where: {
      status: 'APPROVED',
      interview: { userId },
    },
    orderBy: { approvedAt: 'desc' },
    include: {
      advisor: {
        include: {
          user: { select: { name: true } },
        },
      },
    },
  });

  return approval;
}

/** Emphasis/customization for scoring — reads canonical assignment scope. */
export async function getScoringCustomizationForClient(
  clientUserId: string,
): Promise<CustomizationConfig | null> {
  const catalog = await getPlatformPillarCatalog();
  const scope = await getClientAssessmentScope(clientUserId);
  if (scope.includedPillars.length === 0 || scope.focusAreas.length === 0) {
    return null;
  }
  return getCustomizationConfig(scope.focusAreas, catalog);
}

/**
 * Get customization configuration for a user based on engagement scope.
 * Returns null if intake is not approved or waived with pillar scope set.
 */
export async function getCustomizationForUser(userId: string): Promise<CustomizationConfig | null> {
  const catalog = await getPlatformPillarCatalog();
  const [gate, scope] = await Promise.all([
    getClientIntakeGateState(userId),
    getClientAssessmentScope(userId),
  ]);

  if (!gate.intakeApproved && !gate.intakeWaived) {
    return null;
  }

  if (gate.assessmentScopePending || scope.includedPillars.length === 0) {
    return null;
  }

  const approval = gate.intakeApproved ? await getActiveApprovalForUser(userId) : null;
  if (!gate.intakeWaived && !approval) {
    return null;
  }

  const config = getCustomizationConfig(scope.focusAreas, catalog);

  return {
    ...config,
    advisorName: approval?.advisor.user.name || undefined,
    approvalId: approval?.id ?? scope.approvalId ?? undefined,
  };
}
