import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminEnterpriseLifecyclePanel } from "@/components/admin/AdminEnterpriseLifecyclePanel";
import { getEnterpriseDetailForAdmin } from "@/lib/admin/queries";
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
          <Badge variant={isSuspended ? "warning" : "success"}>
            {isSuspended ? "Suspended" : "Active"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground font-mono">{enterprise.slug}</p>
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
            <p className="text-muted-foreground">Subscription</p>
            <p className="font-medium">
              {enterprise.subscriptionStatus
                ? humanizeToken(enterprise.subscriptionStatus)
                : "None"}
            </p>
          </div>
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
