import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { buildAdvisorConfigSnapshot } from "@/lib/methodology/snapshot";
import { riskAreasFromSnapshot, getPillarCountLabel } from "@/lib/methodology/snapshot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function MethodologyPreviewPage() {
  let profileId: string;
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    profileId = profile.id;
  } catch {
    redirect("/signin");
  }

  const snapshot = await buildAdvisorConfigSnapshot(profileId);
  const areas = riskAreasFromSnapshot(snapshot);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/methodology">Methodology</Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Preview as client</h1>
        <p className="text-sm text-muted-foreground">
          Live methodology dry run — not pinned to an intake snapshot.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{getPillarCountLabel(snapshot)}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {areas.map((area) => (
              <li key={area.id}>{area.name}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Intake script: {snapshot.intakeQuestions.length} questions · Recommendation rules:{" "}
            {snapshot.recRules.length}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
