import { Suspense } from "react";

import { InviteClientForm } from "@/components/advisor/invitations/InviteClientForm";
import { InvitationTable } from "@/components/advisor/invitations/InvitationTable";
import { InvitationListFilters } from "@/components/advisor/invitations/InvitationListFilters";
import { InvitationListPagination } from "@/components/advisor/invitations/InvitationListPagination";
import { getInvitationsAction } from "@/lib/actions/invitations";
import { parseInvitationListParams } from "@/lib/invitations/parse-invitation-list-params";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    sentWithin?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const { filters, page, pageSize, hasActiveFilters } = parseInvitationListParams(sp);

  const [{ userId }, result] = await Promise.all([
    requireAdvisorRole(),
    getInvitationsAction(filters, { page, pageSize }),
  ]);
  const profile = await getAdvisorProfileOrThrow(userId);

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

  const { items: invitations, totalCount } = result.data!;

  return (
    <div className="space-y-8">
      <InviteClientForm firmName={profile.firmName} />

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
        <InvitationListPagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          filters={filters}
        />
      </div>
    </div>
  );
}
