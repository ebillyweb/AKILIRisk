import { requireAdminRole } from "@/lib/admin/auth";
import { getRiskThresholdsForAdmin } from "@/lib/admin/platform-settings-actions";
import { AdminRiskThresholdsForm } from "@/components/admin/AdminRiskThresholdsForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminRiskThresholdsPage() {
  await requireAdminRole();
  const res = await getRiskThresholdsForAdmin();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk-tier thresholds</CardTitle>
          <CardDescription>
            BRD §4.2 + §7.1: configurable Low / Medium / High cutoffs against the 0–100
            resilience score. Defaults are 80 / 60 / 40 (the original hardcoded values).
            Audit row written on every save (filter the audit log by{" "}
            <code className="text-xs">risk_thresholds.update</code> to see history).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!res.success ? (
            <p className="text-sm text-destructive">{res.error}</p>
          ) : (
            <AdminRiskThresholdsForm
              initialLowMin={res.data.lowMin}
              initialMediumMin={res.data.mediumMin}
              initialHighMin={res.data.highMin}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
