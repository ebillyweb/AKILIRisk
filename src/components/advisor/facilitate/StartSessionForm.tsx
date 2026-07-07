"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, PlayCircle, UserPlus } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createClientAndStartFacilitatedSession,
  startFacilitatedSessionForClient,
} from "@/lib/actions/facilitated-session-actions";
import type { FacilitatedLauncherData } from "@/lib/actions/facilitated-session-actions";
import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";
import { clientLimitUpgradeMessage } from "@/lib/billing/client-limit";
import { billingPlanNavigationLabel } from "@/lib/billing/billing-plan-cta";
import { ClientLimitUpgradeDialog } from "@/components/advisor/billing/ClientLimitGate";
import { facilitatedSessionResumePath } from "@/lib/facilitated/paths";
import { formatFacilitatedLauncherClientOption } from "@/lib/facilitated/launcher-display";

interface StartSessionFormProps {
  data: FacilitatedLauncherData;
  clientLimitStatus: ClientLimitSnapshot | null;
}

type SessionMode = "portfolio" | "new";

function formatSessionStatus(status: string): string {
  return status.replaceAll("_", " ");
}

export function StartSessionForm({ data, clientLimitStatus }: StartSessionFormProps) {
  const router = useRouter();
  const [clientLimitDialogOpen, setClientLimitDialogOpen] = useState(false);
  const [isStartingExisting, startExistingTransition] = useTransition();
  const [isCreatingClient, startCreateTransition] = useTransition();
  const [mode, setMode] = useState<SessionMode>(
    data.clients.length > 0 ? "portfolio" : "new",
  );
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  useEffect(() => {
    if (data.clients.length === 0) {
      setMode("new");
    }
  }, [data.clients.length]);

  const selectedClient = useMemo(
    () => data.clients.find((client) => client.id === selectedClientId),
    [data.clients, selectedClientId],
  );
  const hasOpenSession = Boolean(selectedClient?.openSession);
  const atClientLimit = clientLimitStatus ? !clientLimitStatus.canAddClient : false;
  const isBusy = isStartingExisting || isCreatingClient;

  const handleStartExisting = () => {
    if (!selectedClientId) {
      toast.error("Select a client to continue");
      return;
    }
    startExistingTransition(async () => {
      const result = await startFacilitatedSessionForClient({
        clientId: selectedClientId,
        resumeExisting: true,
      });
      if (result.success) {
        router.push(result.redirectTo);
        return;
      }
      toast.error(result.error ?? "Could not start session");
    });
  };

  const handleCreateAndStart = () => {
    if (atClientLimit) {
      setClientLimitDialogOpen(true);
      return;
    }
    startCreateTransition(async () => {
      const result = await createClientAndStartFacilitatedSession({
        clientName: newClientName,
        clientEmail: newClientEmail,
      });
      if (result.success) {
        router.push(result.redirectTo);
        return;
      }
      if ("errors" in result && result.errors) {
        const first = Object.values(result.errors)[0]?.[0];
        toast.error(first ?? "Invalid client details");
        return;
      }
      toast.error(result.error ?? "Could not create client");
    });
  };

  return (
    <div className="grid gap-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Start a live session</CardTitle>
          <CardDescription>
            Conduct intake and assessment in person or on a call — the client does not
            need to sign in. Use someone already in your portfolio, or add a new
            household on the spot (no invitation email required).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as SessionMode)}
            className="gap-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="portfolio" disabled={data.clients.length === 0}>
                Portfolio client
              </TabsTrigger>
              <TabsTrigger value="new">Someone new</TabsTrigger>
            </TabsList>

            <TabsContent value="portfolio" className="space-y-4">
              {data.clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No assigned clients yet. Switch to Someone new, or{" "}
                  <Link href="/advisor/invitations" className="font-medium text-primary underline-offset-4 hover:underline">
                    send an invitation
                  </Link>{" "}
                  for self-service onboarding.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="facilitate-client">Client</Label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger id="facilitate-client">
                        <SelectValue placeholder="Search your portfolio…" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {formatFacilitatedLauncherClientOption(client)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={isBusy || !selectedClientId}
                    onClick={handleStartExisting}
                  >
                    {isStartingExisting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <PlayCircle className="size-4" />
                        {hasOpenSession ? "Resume session" : "Start session"}
                      </>
                    )}
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="new" className="space-y-4">
              {atClientLimit && clientLimitStatus ? (
                <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                  <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                    <Lock className="size-4" aria-hidden />
                    Client limit reached
                  </div>
                  <p>{clientLimitUpgradeMessage(clientLimitStatus)}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setClientLimitDialogOpen(true)}
                  >
                    {billingPlanNavigationLabel()}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="facilitate-name">Full name</Label>
                    <Input
                      id="facilitate-name"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Jordan Smith"
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facilitate-email">Email</Label>
                    <Input
                      id="facilitate-email"
                      type="email"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      placeholder="client@example.com"
                      autoComplete="email"
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      isBusy || !newClientName.trim() || !newClientEmail.trim()
                    }
                    onClick={handleCreateAndStart}
                  >
                    {isCreatingClient ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="size-4" />
                        Create household &amp; start session
                      </>
                    )}
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {clientLimitStatus ? (
        <ClientLimitUpgradeDialog
          status={clientLimitStatus}
          open={clientLimitDialogOpen}
          onOpenChange={setClientLimitDialogOpen}
        />
      ) : null}

      {data.openSessions.length > 0 && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Resume open sessions</CardTitle>
            <CardDescription>
              Pick up intake or in-progress assessments you already started. Completed
              assessments move to your pipeline for formal review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.openSessions.map((session) => (
              <Link
                key={session.id}
                href={facilitatedSessionResumePath(session.id, session.status)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {session.clientDisplayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Started {new Date(session.startedAt).toLocaleString()}
                  </p>
                  {session.progressDetail ? (
                    <p className="text-xs text-muted-foreground">{session.progressDetail}</p>
                  ) : null}
                </div>
                <Badge variant="secondary">{formatSessionStatus(session.status)}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
