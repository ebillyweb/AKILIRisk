import { InvitationStatus } from "@prisma/client";

import { INVITATIONS_PAGE_SIZE } from "@/lib/invitations/constants";
import type { InvitationListFilters } from "@/lib/invitations/types";

const INVITATION_STATUSES = new Set<string>(Object.values(InvitationStatus));
const SENT_WITHIN_VALUES = new Set([7, 30, 90]);

export function parseInvitationListParams(searchParams: {
  status?: string;
  search?: string;
  sentWithin?: string;
  page?: string;
}): {
  filters: InvitationListFilters;
  page: number;
  pageSize: number;
  hasActiveFilters: boolean;
} {
  const filters: InvitationListFilters = {};

  if (searchParams.status && INVITATION_STATUSES.has(searchParams.status)) {
    filters.status = searchParams.status as InvitationStatus;
  }

  const search = searchParams.search?.trim();
  if (search) {
    filters.search = search;
  }

  const sentWithinRaw = searchParams.sentWithin
    ? Number.parseInt(searchParams.sentWithin, 10)
    : NaN;
  if (SENT_WITHIN_VALUES.has(sentWithinRaw)) {
    filters.sentWithinDays = sentWithinRaw as 7 | 30 | 90;
  }

  const pageRaw = searchParams.page ? Number.parseInt(searchParams.page, 10) : NaN;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const hasActiveFilters = Boolean(
    filters.status || filters.search || filters.sentWithinDays
  );

  return {
    filters,
    page,
    pageSize: INVITATIONS_PAGE_SIZE,
    hasActiveFilters,
  };
}

export function buildInvitationsListHref(
  filters: InvitationListFilters,
  page: number
): string {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }
  if (filters.sentWithinDays) {
    params.set("sentWithin", String(filters.sentWithinDays));
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return `/advisor/invitations${query ? `?${query}` : ""}`;
}
