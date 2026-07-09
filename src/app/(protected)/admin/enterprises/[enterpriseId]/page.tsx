import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminEnterpriseLifecyclePanel } from "@/components/admin/AdminEnterpriseLifecyclePanel";
import { AdminEnterpriseSubdomainPanel } from "@/components/admin/AdminEnterpriseSubdomainPanel";
import { AdminEnterpriseSubscriptionPanel } from "@/components/admin/AdminEnterpriseSubscriptionPanel";
import { getEnterpriseDetailForAdmin } from "@/lib/admin/queries";
import { TIER_DISPLAY_NAME } from "@/lib/billing/tier-catalog";
import type { SelfServeTier } from "@/lib/billing/tier-catalog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function humanizeToken(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

type PageProps = {
  params: Promise<{ enterpriseId: string }>;
};

export default async function AdminEnterpriseDetailPage({ params }: PageProps) {
  const { enterpriseId } = await params;
  const enterprise = await getEnterpriseDetailForAdmin(enterpriseId);
  if (!enterprise) notFound();

  const isSuspended = enterprise.status === "SUSPENDED";
  const isProvisioning = enterprise.status === "PROVISIONING";

  return (
    <div className="space-y-6">
      <Link
        href="/admin/enterprises"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to enterprises
      </Link>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{enterprise.name}</h1>
          {isSuspended ? (
            <Badge variant="warning">Suspended</Badge>
          ) : isProvisioning ? (
            <Badge variant="secondary">Provisioning</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-mono">{enterprise.slug}</p>
        {isProvisioning ? (
          <p className="text-sm text-muted-foreground">
            Firm setup is running in the background. Refresh this page in a minute if status
            stays on Provisioning.
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Firm overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Owner</p>
            <p className="font-medium">{enterprise.ownerName ?? "—"}</p>
            {enterprise.ownerEmail ? (
              <p className="text-muted-foreground">{enterprise.ownerEmail}</p>
            ) : null}
          </div>
          <div>
            <p className="text-muted-foreground">Seats</p>
            <p className="font-medium">
              {enterprise.activeSeats} / {enterprise.seatLimit}
              {enterprise.seatOverage > 0 ? ` (+${enterprise.seatOverage} over)` : ""}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Client cap</p>
            <p className="font-medium">{enterprise.clientLimit}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Per-advisor cap</p>
            <p className="font-medium">{enterprise.perAdvisorClientLimit}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Payment</p>
            <p className="font-medium">{humanizeToken(enterprise.paymentMethod)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Module tier</p>
            <p className="font-medium">
              {enterprise.moduleTier
                ? TIER_DISPLAY_NAME[enterprise.moduleTier as SelfServeTier] ??
                  humanizeToken(enterprise.moduleTier)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Billing cycle</p>
            <p className="font-medium">
              {enterprise.billingCycle ? humanizeToken(enterprise.billingCycle) : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Subscription</p>
            <p className="font-medium">
              {enterprise.subscriptionStatus
                ? humanizeToken(enterprise.subscriptionStatus)
                : "None"}
            </p>
          </div>
        </CardContent>
      </Card>

      {enterprise.moduleTier && enterprise.billingCycle ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Module subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminEnterpriseSubscriptionPanel
              enterpriseId={enterprise.id}
              moduleTier={enterprise.moduleTier as SelfServeTier}
              billingCycle={enterprise.billingCycle as "MONTHLY" | "ANNUAL"}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portal subdomain</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminEnterpriseSubdomainPanel
            enterpriseId={enterprise.id}
            currentSubdomain={enterprise.currentSubdomain}
            subdomainActive={enterprise.subdomainActive}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminEnterpriseLifecyclePanel
            enterpriseId={enterprise.id}
            slug={enterprise.slug}
            status={enterprise.status}
          />
        </CardContent>
      </Card>
    </div>
  );
}
