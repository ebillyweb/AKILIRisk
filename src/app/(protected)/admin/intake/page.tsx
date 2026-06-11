import Link from "next/link";
import { Mic } from "lucide-react";
import { getIntakeForAdmin } from "@/lib/admin/queries";
import { formatIntakeApprovalStatus } from "@/lib/intake/approval-status-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, "default" | "secondary" | "success" | "warning" | "info" | "outline"> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "secondary",
  COMPLETED: "success",
  SUBMITTED: "success",
};

export default async function AdminIntakePage() {
  const interviews = await getIntakeForAdmin();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Intake question bank</CardTitle>
            <CardDescription>
              Edit the spoken questions clients hear during the audio intake interview — copy,
              order, and visibility.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link href="/admin/intake/questions" className="inline-flex items-center gap-2">
              <Mic className="size-4" aria-hidden />
              Open question bank
            </Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intake interviews ({interviews.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {interviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No intake interviews found.</p>
          ) : (
            <ul className="divide-y divide-border">
              {interviews.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium">{i.user.name ?? i.user.email}</p>
                    <p className="text-sm text-muted-foreground">{i.user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {i._count.responses} responses
                      {i.approval &&
                        ` · Approval: ${formatIntakeApprovalStatus(i.approval.status)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/intake/${i.id}`}>Review answers</Link>
                    </Button>
                    <Badge variant={STATUS_COLORS[i.status] ?? "outline"}>{i.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
