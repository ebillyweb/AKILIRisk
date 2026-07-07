import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSuperAdminRole } from "@/lib/admin/auth";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminPillarsPage() {
  try {
    await requireSuperAdminRole();
  } catch {
    redirect("/admin");
  }

  const pillars = await loadPlatformPillars();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">Admin</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/assessment/questions">Assessment starter bank</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/intake/questions">Intake starter script</Link>
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Platform risk domains</h1>
        <p className="text-sm text-muted-foreground">
          Canonical 10 risk domain catalog. Advisor methodology clones from this catalog and platform
          starter banks.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {pillars.length} risk domain{pillars.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pillars.map((pillar) => (
            <div
              key={pillar.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
            >
              <div className="space-y-1">
                <p className="font-medium">{pillar.name}</p>
                <p className="text-xs text-muted-foreground">{pillar.slug}</p>
                {pillar.summary ? (
                  <p className="text-sm text-muted-foreground">{pillar.summary}</p>
                ) : null}
              </div>
              <Badge variant="secondary">Order {pillar.defaultOrder}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
