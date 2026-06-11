import { InvitationStatus } from "@prisma/client";

export { InvitationStatus } from "@prisma/client";

export interface CreateInvitationInput {
  clientEmail: string;
  clientName?: string;
  personalMessage?: string;
  intakeWaived?: boolean;
  includedPillars?: string[];
  focusAreas?: string[];
}

export interface InvitationWithDetails {
  id: string;
  code: string;
  prefillEmail: string | null;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  createdAt: Date;
  createdBy: string | null;
  status: InvitationStatus;
  statusUpdatedAt: Date;
  personalMessage: string | null;
  clientName: string | null;
  resendCount: number;
  intakeWaived?: boolean;
  includedPillars?: string[];
  focusAreas?: string[];
  advisor: {
    id: string;
    firmName: string | null;
    user: {
      name: string | null;
      email: string;
    };
  } | null;
  isExpired: boolean;
  canResend: boolean;
}

export interface InvitationListFilters {
  status?: InvitationStatus;
  search?: string;
  /** Limit to invitations created within the last N days. */
  sentWithinDays?: 7 | 30 | 90;
}

export interface InvitationListResult {
  items: InvitationWithDetails[];
  totalCount: number;
  page: number;
  pageSize: number;
}