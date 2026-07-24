import { Suspense } from "react";

import { getClientDetailData } from "@/lib/actions/pipeline-actions";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import {
  isEnterpriseActionPlanWorkspaceEnabled,
  isEnterpriseDocumentRequirementsWorkspaceEnabled,
  isEnterpriseSkipIntakeWorkspaceEnabled,
  resolveEnterpriseMemberVisibilityContext,
} from "@/lib/enterprise/advisor-member-visibility";
import { ClientDetailView } from "@/components/pipeline/ClientDetailView";
import { PipelineClientUnavailable } from "@/components/pipeline/PipelineClientUnavailable";
import ClientDetailLoading from "./loading";

interface ClientDetailPageProps {
  params: Promise<{
    clientId: string;
  }>;
}

function isPipelineAccessMiss(error: string | undefined): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes("not found") ||
    normalized.includes("not assigned")
  );
}

async function ClientDetailContent({ clientId }: { clientId: string }) {
  const [{ userId }, result] = await Promise.all([
    requireAdvisorRole(),
    getClientDetailData(clientId),
  ]);

  if (!result.success) {
    if (isPipelineAccessMiss(result.error)) {
      return <PipelineClientUnavailable clientId={clientId} />;
    }
    throw new Error(result.error || "Failed to load client data");
  }

  const visibilityContext = await resolveEnterpriseMemberVisibilityContext(userId);
  const canSkipIntake =
    isEnterpriseSkipIntakeWorkspaceEnabled(visibilityContext);
  const documentRequirementsEnabled =
    isEnterpriseDocumentRequirementsWorkspaceEnabled(visibilityContext);
  const actionPlanEnabled =
    isEnterpriseActionPlanWorkspaceEnabled(visibilityContext);
  const canPermanentlyDelete =
    visibilityContext.role === "OWNER" || visibilityContext.role === "ADMIN";

  return (
    <ClientDetailView
      detail={result.data!}
      canSkipIntake={canSkipIntake}
      documentRequirementsEnabled={documentRequirementsEnabled}
      actionPlanEnabled={actionPlanEnabled}
      canPermanentlyDelete={canPermanentlyDelete}
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
