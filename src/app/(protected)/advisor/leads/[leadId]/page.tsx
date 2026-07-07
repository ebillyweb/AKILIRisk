import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { revalidatePath } from "next/cache";
import { AssessmentLeadDetailPanel } from "@/components/advisor/leads/AssessmentLeadDetailPanel";
import {
  getAssignedGovernanceLeadForAdvisor,
  markLeadNotificationsReadForAdvisor,
} from "@/lib/advisor/governance-lead-queries";

export default async function AdvisorLeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const lead = await getAssignedGovernanceLeadForAdvisor(leadId);

  if (!lead) {
    notFound();
  }

  await markLeadNotificationsReadForAdvisor(lead.id);
  revalidatePath("/advisor/leads");
  revalidatePath("/advisor/notifications");

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Link
          href="/advisor/leads"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to assessment leads
        </Link>
        <header className="space-y-1">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Lead</p>
          <h1 className="text-3xl font-semibold">{lead.name}</h1>
        </header>
      </div>

      <AssessmentLeadDetailPanel lead={lead} />
    </div>
  );
}
