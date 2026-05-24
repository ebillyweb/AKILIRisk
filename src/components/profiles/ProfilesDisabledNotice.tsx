import Link from "next/link";
import { UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ProfilesDisabledNotice() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
          <UsersRound className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">Household profiles are not available</h2>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Your advisor has turned off household profiles for their clients. You can still
            complete your intake and assessment using generic question text. Contact your advisor
            if you have questions.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
