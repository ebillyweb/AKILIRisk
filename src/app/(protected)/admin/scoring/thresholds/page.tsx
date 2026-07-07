import { requireSuperAdminRole } from "@/lib/admin/auth";
import { getRiskThresholdsForAdmin } from "@/lib/admin/platform-settings-actions";
import { AdminRiskThresholdsForm } from "@/components/admin/AdminRiskThresholdsForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminRiskThresholdsPage() {
  await requireSuperAdminRole();
  const res = await getRiskThresholdsForAdmin();

  return (
    <div className="space-y-6">
      <Card data-tour="config-primary-form">
        <CardHeader>
          <CardTitle className="text-base">When is a client in good shape?</CardTitle>
          <CardDescription>
            Set platform-wide score lines that decide whether an assessment result is
            labeled low, medium, high, or urgent. Advisors and clients see these labels
            on dashboards and in reports.
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
