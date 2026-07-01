import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function MethodologyCatalogUpdatesPage() {
  let profile: Awaited<ReturnType<typeof getAdvisorProfileOrThrow>>;
  try {
    const { userId } = await requireAdvisorRole();
    profile = await getAdvisorProfileOrThrow(userId);
  } catch {
    redirect("/signin");
  }

  const pillars = await loadPlatformPillars();
  const catalogRow = await prisma.pillar.findFirst({
    where: { archivedAt: null },
    select: { catalogVersion: true },
    orderBy: { defaultOrder: "asc" },
  });
  const catalogVersion = catalogRow?.catalogVersion ?? 1;
  const seen = profile.catalogVersionSeen ?? 0;
  const clonedAt = profile.starterContentClonedAt;

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/methodology">Your methodology</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-methodology-catalog-updates"
        title="Catalog updates"
        description="Platform pillar catalog version vs. what your profile has seen."
      />
      <Card data-tour="config-primary-list">
        <CardHeader>
          <CardTitle className="text-base">Catalog sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Platform catalog version: {catalogVersion}</p>
          <p>Your profile last saw: {seen}</p>
          <p>
            Starter content cloned:{" "}
            {clonedAt ? clonedAt.toLocaleString() : "Not yet cloned"}
          </p>
          {catalogVersion > seen ? (
            <p className="text-amber-700">
              New platform catalog changes are available. Re-run advisor defaults seed or contact
              platform admin to merge updates.
            </p>
          ) : (
            <p className="text-muted-foreground">Your catalog view is up to date.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform pillars ({pillars.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {pillars.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
