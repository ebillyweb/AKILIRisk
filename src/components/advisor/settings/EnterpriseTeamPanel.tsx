"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  inviteEnterpriseTeamMemberAction,
  reactivateEnterpriseTeamMemberAction,
  suspendEnterpriseTeamMemberAction,
} from "@/lib/actions/enterprise-team-actions";
import type { EnterpriseTeamMemberView } from "@/lib/enterprise/team-invite";
import type { EnterpriseSeatUsage } from "@/lib/enterprise/seat-reporting";

type EnterpriseTeamPanelProps = {
  enterpriseName: string;
  role: "OWNER" | "ADMIN";
  members: EnterpriseTeamMemberView[];
  seatUsage: EnterpriseSeatUsage;
};

export function EnterpriseTeamPanel({
  enterpriseName,
  role,
  members,
  seatUsage,
}: EnterpriseTeamPanelProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "ADVISOR">("ADVISOR");
  const [inviting, setInviting] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  const overage = seatUsage.seatOverage > 0;

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviting(true);
    try {
      const result = await inviteEnterpriseTeamMemberAction({
        email,
        role: inviteRole,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Team invitation sent.");
      setEmail("");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Failed to send invitation.");
    } finally {
      setInviting(false);
    }
  };

  const handleSuspend = async (membershipId: string) => {
    setPendingMemberId(membershipId);
    try {
      const result = await suspendEnterpriseTeamMemberAction({ membershipId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Team member suspended.");
      startTransition(() => router.refresh());
    } finally {
      setPendingMemberId(null);
    }
  };

  const handleReactivate = async (membershipId: string) => {
    setPendingMemberId(membershipId);
    try {
      const result = await reactivateEnterpriseTeamMemberAction({ membershipId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Team member reactivated.");
      startTransition(() => router.refresh());
    } finally {
      setPendingMemberId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            Manage advisors and administrators for {enterpriseName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={overage ? "destructive" : "secondary"}>
            {seatUsage.activeSeats} / {seatUsage.seatLimit} seats
          </Badge>
          {overage ? (
            <Badge variant="outline">Over limit by {seatUsage.seatOverage}</Badge>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Invite teammate</h2>
          <p className="text-sm text-muted-foreground">
            Invited advisors receive their own login. Seat overage is reported but not blocked in v1.
          </p>
        </div>
        <form onSubmit={handleInvite} className="grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="team-invite-email">Email</Label>
            <Input
              id="team-invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="advisor@firm.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-invite-role">Role</Label>
            <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as "ADMIN" | "ADVISOR")}>
              <SelectTrigger id="team-invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADVISOR">Advisor</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={inviting}>
            {inviting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            <span className="ml-2">Send invite</span>
          </Button>
        </form>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold tracking-tight">Members</h2>
        </div>
        <div className="divide-y">
          {members.map((member) => {
            const isOwner = member.role === "OWNER";
            const canManageMember =
              !isOwner && (role === "OWNER" || member.role === "ADVISOR");
            const busy = pendingMemberId === member.id;

            return (
              <div
                key={member.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{member.name || member.email}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{member.role}</Badge>
                  <Badge
                    variant={
                      member.status === "ACTIVE"
                        ? "default"
                        : member.status === "INVITED"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {member.status}
                  </Badge>
                  {canManageMember && member.status === "ACTIVE" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleSuspend(member.id)}
                    >
                      Suspend
                    </Button>
                  ) : null}
                  {canManageMember && member.status === "SUSPENDED" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleReactivate(member.id)}
                    >
                      Reactivate
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
