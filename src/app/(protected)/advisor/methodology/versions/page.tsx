import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { loadAdvisorSnapshots } from "@/lib/methodology/methodology-queries";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function MethodologyVersionsPage() {
  let profileId: string;
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    profileId = profile.id;
  } catch {
    redirect("/signin");
  }

  const snapshots = await loadAdvisorSnapshots(profileId);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/advisor/methodology">Your methodology</Link>
      </Button>
      <ConfigurationPageHeader
        tourId="advisor-methodology-versions"
        title="Pinned versions"
        description="Intake snapshots frozen when clients start their interview."
      />
      <Card data-tour="config-primary-list">
        <CardHeader>
          <CardTitle className="text-base">
            {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No snapshots yet.</p>
          ) : (
            snapshots.map((snap) => {
              const email = snap.intakeInterview.user.emailCiphertext
                ? decryptUserEmail(snap.intakeInterview.user.emailCiphertext)
                : "Client";
              return (
                <div key={snap.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{email}</p>
                  <p className="text-muted-foreground">
                    {snap.takenAt.toLocaleString()} · schema v{snap.schemaVersion} ·{" "}
                    {snap.intakeInterview.status}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
