import { getAdvisorWorkspaceHomeData } from "@/lib/actions/advisor-workspace-actions";
import { AdvisorWorkspaceHome } from "@/components/advisor/workspace/AdvisorWorkspaceHome";

export default async function AdvisorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [sp, result] = await Promise.all([searchParams, getAdvisorWorkspaceHomeData()]);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div className="py-12 text-center">
          <p className="text-destructive text-sm">
            Error loading advisor workspace: {result.error}
          </p>
        </div>
      </div>
    );
  }

  return <AdvisorWorkspaceHome data={result.data} error={sp.error} />;
}
