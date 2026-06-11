import Link from "next/link";
import { PlayCircle } from "lucide-react";

import { StartSessionForm } from "@/components/advisor/facilitate/StartSessionForm";
import { Button } from "@/components/ui/button";
import { getFacilitatedLauncherData } from "@/lib/actions/facilitated-session-actions";

export default async function FacilitateLauncherPage() {
  const data = await getFacilitatedLauncherData();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2 border-b border-border/50 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Live sessions
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Start client session</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Conduct intake and assessment with a client in person or on a call — no client login
          required for this session.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href="/advisor/pipeline">
            <PlayCircle className="size-4" />
            Back to pipeline
          </Link>
        </Button>
      </header>

      <StartSessionForm data={data} />
    </div>
  );
}
