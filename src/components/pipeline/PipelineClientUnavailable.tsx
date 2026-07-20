import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shown when a pipeline client URL is valid-shaped but the signed-in advisor
 * has no ACTIVE/INACTIVE assignment (or firm-scope access) for that household.
 * Prefer this over the global 404 page so the message does not imply a bad URL.
 */
export function PipelineClientUnavailable({
  clientId,
}: {
  clientId?: string;
}) {
  return (
    <div className="container mx-auto max-w-2xl py-10">
      <Card className="border-border/70 bg-card/60 shadow-sm ring-1 ring-border/30">
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="flex size-11 items-center justify-center rounded-lg border border-border/60 bg-muted/60">
            <Users className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pipeline access
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              This household isn&apos;t in your pipeline
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              The link may be for another advisor&apos;s book, an ended
              assignment, or a household you don&apos;t have firm-wide access
              to. Open Clients to continue with households assigned to you.
            </p>
          </div>

          <Alert variant="info">
            <AlertTitle>What to try next</AlertTitle>
            <AlertDescription>
              Sign in as the advisor who owns this engagement, or ask a firm
              owner to assign the household to your book.
              {clientId ? (
                <span className="mt-2 block font-mono text-xs text-muted-foreground">
                  Reference: {clientId}
                </span>
              ) : null}
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/advisor/pipeline">
                <Users className="size-4" aria-hidden />
                Open Clients
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/advisor">
                <ArrowLeft className="size-4" aria-hidden />
                Subscriber hub
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
