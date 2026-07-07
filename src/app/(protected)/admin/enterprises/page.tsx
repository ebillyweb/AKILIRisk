import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { getEnterprisesForAdmin } from "@/lib/admin/queries";
import { TIER_DISPLAY_NAME } from "@/lib/billing/tier-catalog";
import type { SelfServeTier } from "@/lib/billing/tier-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function humanizeToken(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function enterpriseStatusBadge(status: string) {
  if (status === "SUSPENDED") {
    return <Badge variant="warning">Suspended</Badge>;
  }
  if (status === "PROVISIONING") {
    return <Badge variant="secondary">Provisioning</Badge>;
  }
  return <Badge variant="success">Active</Badge>;
}

export default async function AdminEnterprisesPage() {
  const enterprises = await getEnterprisesForAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Enterprise firms{" "}
            <span className="font-normal text-muted-foreground">({enterprises.length})</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Sales-provisioned firms with multi-advisor seats and firm-level billing.
          </p>
        </div>
        <Button asChild className="shrink-0 self-start sm:self-auto">
          <Link href="/admin/enterprises/new" className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Provision enterprise
          </Link>
        </Button>
      </div>

      {enterprises.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-sm text-muted-foreground">
              No enterprise firms yet. Use Provision enterprise after sales closes a contract.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" aria-hidden />
              Firms
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Firm</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Owner</th>
                  <th className="pb-2 pr-4 font-medium">Slug</th>
                  <th className="pb-2 pr-4 font-medium">Seats</th>
                  <th className="pb-2 pr-4 font-medium">Seat overage</th>
                  <th className="pb-2 pr-4 font-medium">Clients cap</th>
                  <th className="pb-2 pr-4 font-medium">Payment</th>
                  <th className="pb-2 pr-4 font-medium">Module tier</th>
                  <th className="pb-2 pr-4 font-medium">Subscription</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {enterprises.map((enterprise) => (
                  <tr key={enterprise.id} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-medium">{enterprise.name}</td>
                    <td className="py-3 pr-4">{enterpriseStatusBadge(enterprise.status)}</td>
                    <td className="py-3 pr-4">
                      <div>{enterprise.ownerName ?? "—"}</div>
                      {enterprise.ownerEmail ? (
                        <div className="text-xs text-muted-foreground">
                          {enterprise.ownerEmail}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">{enterprise.slug}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {enterprise.activeSeats} / {enterprise.seatLimit}
                    </td>
                    <td className="py-3 pr-4">
                      {enterprise.seatOverage > 0 ? (
                        <Badge variant="warning">+{enterprise.seatOverage}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">{enterprise.clientLimit}</td>
                    <td className="py-3 pr-4">{humanizeToken(enterprise.paymentMethod)}</td>
                    <td className="py-3 pr-4">
                      {enterprise.moduleTier
                        ? TIER_DISPLAY_NAME[enterprise.moduleTier as SelfServeTier] ??
                          humanizeToken(enterprise.moduleTier)
                        : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {enterprise.subscriptionStatus
                        ? humanizeToken(enterprise.subscriptionStatus)
                        : "None"}
                    </td>
                    <td className="py-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/enterprises/${enterprise.id}`}>Manage</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
