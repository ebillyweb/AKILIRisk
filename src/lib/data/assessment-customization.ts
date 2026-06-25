/**
 * Assessment Customization Data Layer
 *
 * Database queries to fetch approved IntakeApproval for a user
 * and derive CustomizationConfig from approval data.
 */

import 'server-only';
import { prisma } from '@/lib/db';
import { getClientAssessmentScope } from '@/lib/client/assessment-scope';
import { getClientIntakeGateState } from '@/lib/client/intake-gate';
import { getCustomizationConfig, type CustomizationConfig } from '@/lib/assessment/customization';
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

/**
 * Get customization configuration for a user based on their approved intake
 * Returns null if no approved intake exists
 */
export async function getCustomizationForUser(userId: string): Promise<CustomizationConfig | null> {
  const catalog = await getPlatformPillarCatalog();
  const gate = await getClientIntakeGateState(userId);

  if (gate.intakeWaived && !gate.intakeApproved) {
    const scope = await getClientAssessmentScope(userId);
    const config = getCustomizationConfig(scope.focusAreas, catalog);
    return {
      ...config,
      advisorName: undefined,
      approvalId: undefined,
    };
  }

  const approval = await getActiveApprovalForUser(userId);

  if (!approval) {
    return null;
  }

  const config = getCustomizationConfig(approval.focusAreas, catalog);

  return {
    ...config,
    advisorName: approval.advisor.user.name || undefined,
    approvalId: approval.id,
  };
}