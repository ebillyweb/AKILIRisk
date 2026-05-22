import { Suspense } from "react";
import { InvitationStatus } from "@prisma/client";
import { InviteClientForm } from "@/components/advisor/invitations/InviteClientForm";
import { InvitationTable } from "@/components/advisor/invitations/InvitationTable";
import { InvitationListFilters } from "@/components/advisor/invitations/InvitationListFilters";
import { getInvitationsAction } from "@/lib/actions/invitations";
import type { InvitationListFilters as InvitationFilters } from "@/lib/invitations/types";

const INVITATION_STATUSES = new Set<string>(Object.values(InvitationStatus));

function parseInvitationFilters(searchParams: {
  status?: string;
  search?: string;
}): InvitationFilters | undefined {
  const filters: InvitationFilters = {};
  let hasFilter = false;

  if (
    searchParams.status &&
    INVITATION_STATUSES.has(searchParams.status)
  ) {
    filters.status = searchParams.status as InvitationStatus;
    hasFilter = true;
  }

  const search = searchParams.search?.trim();
  if (search) {
    filters.search = search;
    hasFilter = true;
  }

  return hasFilter ? filters : undefined;
}

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const filters = parseInvitationFilters(sp);
  const hasActiveFilters = Boolean(filters);

  const result = await getInvitationsAction(filters);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-destructive text-sm">
            Error loading invitations: {result.error}
          </p>
        </div>
      </div>
    );
  }

  const invitations = result.data!;

  return (
    <div className="space-y-8">
      <InviteClientForm />

      <div className="border-t section-divider" />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Invitation History</h2>
        <Suspense fallback={null}>
          <InvitationListFilters />
        </Suspense>
        <InvitationTable
          invitations={invitations}
          hasActiveFilters={hasActiveFilters}
        />
      </div>
    </div>
  );
}
