"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acceptEnterpriseTeamInviteAction } from "@/lib/actions/enterprise-team-actions";

type EnterpriseTeamJoinConfirmPanelProps = {
  token: string;
  enterpriseName: string;
  inviteeEmail: string;
};

export function EnterpriseTeamJoinConfirmPanel({
  token,
  enterpriseName,
  inviteeEmail,
}: EnterpriseTeamJoinConfirmPanelProps) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);
    try {
      const result = await acceptEnterpriseTeamInviteAction(token);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(`You joined ${result.data.enterpriseName}.`);
      router.replace("/advisor?notice=enterprise_joined");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="Team invitation"
      title={`Join ${enterpriseName}`}
      description="Review this invitation before joining your firm's team workspace."
    >
      <div className="space-y-6">
        <Alert variant="info">
          <AlertDescription>
            You are signed in as <strong>{inviteeEmail}</strong>. Accepting adds you to the{" "}
            <strong>{enterpriseName}</strong> team account on AkiliRisk.
          </AlertDescription>
        </Alert>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={isAccepting}
          onClick={handleAccept}
        >
          {isAccepting ? <Loader2 className="size-4 animate-spin" /> : null}
          <span className={isAccepting ? "ml-2" : undefined}>
            {isAccepting ? "Joining team…" : `Join ${enterpriseName}`}
          </span>
        </Button>
      </div>
    </AuthPanel>
  );
}
