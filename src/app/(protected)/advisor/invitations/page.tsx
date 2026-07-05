import { Suspense } from "react";

import { InviteClientForm } from "@/components/advisor/invitations/InviteClientForm";
import { AdvisorScreenHeader } from "@/components/advisor/layout/AdvisorScreenHeader";
import { ClientLimitBanner } from "@/components/advisor/billing/ClientLimitGate";
import { InvitationTable } from "@/components/advisor/invitations/InvitationTable";
import { InvitationListFilters } from "@/components/advisor/invitations/InvitationListFilters";
import { InvitationListPagination } from "@/components/advisor/invitations/InvitationListPagination";
import { getInvitationsAction } from "@/lib/actions/invitations";
import { parseInvitationListParams } from "@/lib/invitations/parse-invitation-list-params";
import { loadAdvisorAssessmentDomainPickerData } from "@/lib/methodology/advisor-assessment-domains";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { getAdvisorClientLimitStatus } from "@/lib/advisor/client-limit-status.server";
import {
  isEnterpriseMemberVisibilityEnabled,
  resolveEnterpriseMemberVisibilityContext,
} from "@/lib/enterprise/advisor-member-visibility";
import { getAdvisorClientDataPolicyContext } from "@/lib/enterprise/enterprise-client-data-policy";

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
  const [profile, clientLimitStatus, visibilityContext, policyContext] = await Promise.all([
    getAdvisorProfileOrThrow(userId),
    getAdvisorClientLimitStatus(userId),
    resolveEnterpriseMemberVisibilityContext(userId),
    getAdvisorClientDataPolicyContext(userId),
  ]);
  const pseudonymousWorkspaceLabeling =
    policyContext.effective.pseudonymousWorkspaceLabeling;
  const assessmentDomainPicker = await loadAdvisorAssessmentDomainPickerData(profile.id);
  const skipIntakeEnabled = isEnterpriseMemberVisibilityEnabled(
    visibilityContext,
    "skipIntake",
  );

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
      <AdvisorScreenHeader
        kicker="Clients"
        title="Invitations"
        description="Send new client invitations and review invitation history."
      />
      {clientLimitStatus ? <ClientLimitBanner status={clientLimitStatus} /> : null}
      <InviteClientForm
        firmName={profile.firmName}
        assessmentDomainPicker={assessmentDomainPicker}
        clientLimitStatus={clientLimitStatus}
        skipIntakeEnabled={skipIntakeEnabled}
      />

      <div className="border-t section-divider" />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Invitation History</h2>
        <Suspense fallback={null}>
          <InvitationListFilters
            pseudonymousWorkspaceLabeling={pseudonymousWorkspaceLabeling}
          />
        </Suspense>
        <InvitationTable
          invitations={invitations}
          hasActiveFilters={hasActiveFilters}
          pseudonymousWorkspaceLabeling={pseudonymousWorkspaceLabeling}
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
