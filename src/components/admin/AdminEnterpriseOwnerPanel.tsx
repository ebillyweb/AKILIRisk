"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { changeEnterpriseOwnerByAdmin } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type OwnerCandidate = {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
};

type Props = {
  enterpriseId: string;
  currentOwnerName: string | null;
  currentOwnerEmail: string | null;
  candidates: OwnerCandidate[];
};

function candidateLabel(c: OwnerCandidate) {
  const who = c.name?.trim() || c.email || c.userId;
  return c.email ? `${who} (${c.email})` : who;
}

/**
 * Platform-admin control to transfer a firm's ownership to another active member
 * of the same firm. The previous owner is demoted to administrator (keeps firm
 * access); the firm's tenant subdomain and billing contact re-point to the new
 * owner. Both parties are notified by the server action.
 */
export function AdminEnterpriseOwnerPanel({
  enterpriseId,
  currentOwnerName,
  currentOwnerEmail,
  candidates,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);

  const chosen = candidates.find((c) => c.userId === selected) ?? null;

  const onTransfer = async () => {
    if (!chosen) return;
    if (
      !window.confirm(
        `Transfer ownership of this firm to ${candidateLabel(chosen)}?\n\n` +
          `${currentOwnerName ?? currentOwnerEmail ?? "The current owner"} will be demoted to administrator (they keep firm access). ` +
          `The firm's portal subdomain and billing contact move to the new owner. Both are notified.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const result = await changeEnterpriseOwnerByAdmin({
        enterpriseId,
        newOwnerUserId: chosen.userId,
      });
      if (result.success) {
        toast.success(`Ownership transferred to ${chosen.name?.trim() || chosen.email || "the new owner"}`);
        setSelected("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to transfer ownership");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm">
        <span className="text-muted-foreground">Current owner: </span>
        {currentOwnerName || currentOwnerEmail ? (
          <span className="font-medium">
            {currentOwnerName ?? currentOwnerEmail}
            {currentOwnerName && currentOwnerEmail ? (
              <span className="text-muted-foreground"> · {currentOwnerEmail}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No other active members are eligible to take over ownership. Invite or
          activate another advisor on this firm first.
        </p>
      ) : (
        <>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="new-enterprise-owner">New owner</Label>
            <Select value={selected} onValueChange={setSelected} disabled={loading}>
              <SelectTrigger id="new-enterprise-owner">
                <SelectValue placeholder="Choose a member…" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.userId} value={c.userId}>
                    {candidateLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only active members of this firm can become owner. The previous
              owner stays on as an administrator.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={loading || !chosen}
            onClick={() => void onTransfer()}
          >
            {loading ? "Transferring…" : "Transfer ownership"}
          </Button>
        </>
      )}
    </div>
  );
}
