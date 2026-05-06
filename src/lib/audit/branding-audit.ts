import { prisma } from '@/lib/db';

/**
 * Audit action types for advisor branding
 */
export const BRANDING_ACTIONS = {
  UPDATE_BRANDING: 'UPDATE_BRANDING',
  UPLOAD_LOGO: 'UPLOAD_LOGO',
  DELETE_LOGO: 'DELETE_LOGO',
  CLAIM_SUBDOMAIN: 'CLAIM_SUBDOMAIN',
  RELEASE_SUBDOMAIN: 'RELEASE_SUBDOMAIN',
  VERIFY_SUBDOMAIN: 'VERIFY_SUBDOMAIN',
  UPDATE_COLORS: 'UPDATE_COLORS',
  UPDATE_IDENTITY: 'UPDATE_IDENTITY',
  UPDATE_CONTACT: 'UPDATE_CONTACT',
} as const;

/**
 * Entity types for audit logging
 */
export const BRANDING_ENTITIES = {
  BRANDING: 'BRANDING',
  LOGO: 'LOGO',
  SUBDOMAIN: 'SUBDOMAIN',
  COLORS: 'COLORS',
  IDENTITY: 'IDENTITY',
  CONTACT: 'CONTACT',
} as const;

export type BrandingAction = typeof BRANDING_ACTIONS[keyof typeof BRANDING_ACTIONS];
export type BrandingEntity = typeof BRANDING_ENTITIES[keyof typeof BRANDING_ENTITIES];

/**
 * Audit log entry interface
 */
interface AuditLogEntry {
  advisorId: string;
  userId: string;
  action: BrandingAction;
  entityType: BrandingEntity;
  entityId?: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Records an audit log entry for branding actions
 */
export async function auditBrandingAction(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.advisorBrandingAuditLog.create({
      data: {
        advisorId: entry.advisorId,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        previousValues: entry.previousValues,
        newValues: entry.newValues,
        metadata: {
          ...entry.metadata,
          timestamp: new Date().toISOString(),
          userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'Server',
        },
      },
    });
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    // Don't throw - audit failures shouldn't break the main flow
  }
}

/**
 * Helper function to audit branding updates
 */
export async function auditBrandingUpdate(
  advisorId: string,
  userId: string,
  previousValues: Record<string, any>,
  newValues: Record<string, any>,
  metadata?: Record<string, any>
): Promise<void> {
  await auditBrandingAction({
    advisorId,
    userId,
    action: BRANDING_ACTIONS.UPDATE_BRANDING,
    entityType: BRANDING_ENTITIES.BRANDING,
    previousValues,
    newValues,
    metadata,
  });
}

/**
 * Helper function to audit logo uploads
 */
export async function auditLogoUpload(
  advisorId: string,
  userId: string,
  logoData: {
    s3Key: string;
    fileName: string;
    fileSize: number;
    contentType: string;
  },
  metadata?: Record<string, any>
): Promise<void> {
  await auditBrandingAction({
    advisorId,
    userId,
    action: BRANDING_ACTIONS.UPLOAD_LOGO,
    entityType: BRANDING_ENTITIES.LOGO,
    entityId: logoData.s3Key,
    newValues: logoData,
    metadata,
  });
}

/**
 * Helper function to audit logo deletions
 */
export async function auditLogoDelete(
  advisorId: string,
  userId: string,
  logoData: {
    s3Key: string;
    fileName?: string;
  },
  metadata?: Record<string, any>
): Promise<void> {
  await auditBrandingAction({
    advisorId,
    userId,
    action: BRANDING_ACTIONS.DELETE_LOGO,
    entityType: BRANDING_ENTITIES.LOGO,
    entityId: logoData.s3Key,
    previousValues: logoData,
    metadata,
  });
}

/**
 * Helper function to audit subdomain claims
 */
export async function auditSubdomainClaim(
  advisorId: string,
  userId: string,
  subdomain: string,
  metadata?: Record<string, any>
): Promise<void> {
  await auditBrandingAction({
    advisorId,
    userId,
    action: BRANDING_ACTIONS.CLAIM_SUBDOMAIN,
    entityType: BRANDING_ENTITIES.SUBDOMAIN,
    entityId: subdomain,
    newValues: { subdomain },
    metadata,
  });
}

/**
 * Helper function to audit subdomain releases
 */
export async function auditSubdomainRelease(
  advisorId: string,
  userId: string,
  subdomain: string,
  metadata?: Record<string, any>
): Promise<void> {
  await auditBrandingAction({
    advisorId,
    userId,
    action: BRANDING_ACTIONS.RELEASE_SUBDOMAIN,
    entityType: BRANDING_ENTITIES.SUBDOMAIN,
    entityId: subdomain,
    previousValues: { subdomain },
    metadata,
  });
}

/**
 * Get audit log entries for an advisor
 */
export async function getAdvisorAuditLog(
  advisorId: string,
  options: {
    action?: BrandingAction;
    entityType?: BrandingEntity;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
) {
  const {
    action,
    entityType,
    limit = 50,
    offset = 0,
    startDate,
    endDate,
  } = options;

  const where: any = { advisorId };

  if (action) {
    where.action = action;
  }

  if (entityType) {
    where.entityType = entityType;
  }

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) {
      where.timestamp.gte = startDate;
    }
    if (endDate) {
      where.timestamp.lte = endDate;
    }
  }

  const [entries, total] = await Promise.all([
    prisma.advisorBrandingAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        advisor: {
          include: {
            user: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
                // Round-11 commit 2.4b: ciphertext; consumers that
                // need plaintext should decrypt at the call site.
                emailCiphertext: true,
              },
            },
          },
        },
      },
    }),
    prisma.advisorBrandingAuditLog.count({ where }),
  ]);

  return {
    entries,
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * Get audit summary statistics for an advisor
 */
export async function getAdvisorAuditSummary(
  advisorId: string,
  timeRange: 'day' | 'week' | 'month' = 'month'
): Promise<{
  totalActions: number;
  actionBreakdown: Record<BrandingAction, number>;
  entityBreakdown: Record<BrandingEntity, number>;
  recentActivity: boolean;
}> {
  const now = new Date();
  const startDate = new Date();

  switch (timeRange) {
    case 'day':
      startDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
  }

  const entries = await prisma.advisorBrandingAuditLog.findMany({
    where: {
      advisorId,
      timestamp: {
        gte: startDate,
      },
    },
    select: {
      action: true,
      entityType: true,
      timestamp: true,
    },
  });

  const actionBreakdown: Record<string, number> = {};
  const entityBreakdown: Record<string, number> = {};

  entries.forEach(entry => {
    actionBreakdown[entry.action] = (actionBreakdown[entry.action] || 0) + 1;
    entityBreakdown[entry.entityType] = (entityBreakdown[entry.entityType] || 0) + 1;
  });

  // Check for activity in the last 24 hours
  const oneDayAgo = new Date();
  oneDayAgo.setDate(now.getDate() - 1);
  const recentActivity = entries.some(entry => entry.timestamp > oneDayAgo);

  return {
    totalActions: entries.length,
    actionBreakdown: actionBreakdown as Record<BrandingAction, number>,
    entityBreakdown: entityBreakdown as Record<BrandingEntity, number>,
    recentActivity,
  };
}