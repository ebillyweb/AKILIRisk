import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subscriptionQualifiesForPortalEnablement } from "@/lib/billing/advisor-portal-subscription";
import { isBillingEnabled } from "@/lib/billing/config";
import { isSuperAdmin } from "@/lib/admin/auth";
import { auth } from "@/lib/auth";
import { getAdvisorForAdmin } from "@/lib/admin/queries";
import { AdminEditAdvisorForm } from "@/components/admin/AdminEditAdvisorForm";

export default async function AdminEditAdvisorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [advisor, session] = await Promise.all([getAdvisorForAdmin(id), auth()]);
  if (!advisor) notFound();

  const billingFeaturesEnabled = isBillingEnabled();
  const canEnablePortalAccess = subscriptionQualifiesForPortalEnablement(
    advisor.subscription,
    billingFeaturesEnabled
  );
  const superAdmin = isSuperAdmin(session);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/advisors" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Advisors
          </Link>
        </Button>
      </div>
      <AdminEditAdvisorForm
        advisor={advisor}
        billingFeaturesEnabled={billingFeaturesEnabled}
        canEnablePortalAccess={canEnablePortalAccess}
        superAdmin={superAdmin}
      />
    </div>
  );
}
