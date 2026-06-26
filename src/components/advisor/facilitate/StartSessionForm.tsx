"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
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
import {
  createClientAndStartFacilitatedSession,
  startFacilitatedSessionForClient,
} from "@/lib/actions/facilitated-session-actions";
import type { FacilitatedLauncherData } from "@/lib/actions/facilitated-session-actions";
import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";
import { clientLimitUpgradeMessage } from "@/lib/billing/client-limit";
import { ClientLimitUpgradeDialog } from "@/components/advisor/billing/ClientLimitGate";
import { facilitatedSessionResumePath } from "@/lib/facilitated/paths";

interface StartSessionFormProps {
  data: FacilitatedLauncherData;
  clientLimitStatus: ClientLimitSnapshot | null;
}

function formatSessionStatus(status: string): string {
  return status.replaceAll("_", " ");
}

export function StartSessionForm({ data, clientLimitStatus }: StartSessionFormProps) {
  const router = useRouter();
  const [clientLimitDialogOpen, setClientLimitDialogOpen] = useState(false);
  const [isStartingExisting, startExistingTransition] = useTransition();
  const [isCreatingClient, startCreateTransition] = useTransition();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  const selectedClient = useMemo(
    () => data.clients.find((client) => client.id === selectedClientId),
    [data.clients, selectedClientId],
  );
  const hasOpenSession = Boolean(selectedClient?.openSession);

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

  const atClientLimit = clientLimitStatus ? !clientLimitStatus.canAddClient : false;

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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Select existing client</CardTitle>
          <CardDescription>
            Start or resume a live session with someone already in your portfolio.
            Clients with open sessions appear first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assigned clients yet. Create a new client below or send an invitation first.
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
                        {client.name} · {client.email}
                        {client.openSession ? " — open session" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={isStartingExisting || isCreatingClient || !selectedClientId}
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
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Create new client</CardTitle>
          <CardDescription>
            Add a client on the spot — no invitation email required for this session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                Upgrade plan
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
            variant="outline"
            className="w-full"
            disabled={
              isCreatingClient ||
              isStartingExisting ||
              !newClientName.trim() ||
              !newClientEmail.trim()
            }
            onClick={handleCreateAndStart}
          >
            {isCreatingClient ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="size-4" />
                Create client &amp; start
              </>
            )}
          </Button>
          </>
          )}
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
        <Card className="border-border/70 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Resume open sessions</CardTitle>
            <CardDescription>
              Resume intake or in-progress assessments. Completed assessments move to your
              pipeline for formal review.
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
                    {session.clientName ?? "Client"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Started {new Date(session.startedAt).toLocaleString()}
                  </p>
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
