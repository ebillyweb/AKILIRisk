import { Suspense } from "react";
import { notFound } from "next/navigation";

import { getClientDetailData } from "@/lib/actions/pipeline-actions";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import {
  isEnterpriseActionPlanWorkspaceEnabled,
  isEnterpriseDocumentRequirementsWorkspaceEnabled,
  isEnterpriseSkipIntakeWorkspaceEnabled,
  resolveEnterpriseMemberVisibilityContext,
} from "@/lib/enterprise/advisor-member-visibility";
import { ClientDetailView } from "@/components/pipeline/ClientDetailView";
import ClientDetailLoading from "./loading";

interface ClientDetailPageProps {
  params: Promise<{
    clientId: string;
  }>;
}

async function ClientDetailContent({ clientId }: { clientId: string }) {
  const [{ userId }, result] = await Promise.all([
    requireAdvisorRole(),
    getClientDetailData(clientId),
  ]);

  if (!result.success) {
    if (result.error?.includes('not found')) {
      notFound();
    }
    throw new Error(result.error || 'Failed to load client data');
  }

  const visibilityContext = await resolveEnterpriseMemberVisibilityContext(userId);
  const canSkipIntake =
    isEnterpriseSkipIntakeWorkspaceEnabled(visibilityContext);
  const documentRequirementsEnabled =
    isEnterpriseDocumentRequirementsWorkspaceEnabled(visibilityContext);
  const actionPlanEnabled =
    isEnterpriseActionPlanWorkspaceEnabled(visibilityContext);

  return (
    <ClientDetailView
      detail={result.data!}
      canSkipIntake={canSkipIntake}
      documentRequirementsEnabled={documentRequirementsEnabled}
      actionPlanEnabled={actionPlanEnabled}
    />
  );
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { clientId } = await params;

  return (
    <Suspense fallback={<ClientDetailLoading />}>
      <ClientDetailContent clientId={clientId} />
    </Suspense>
  );
}