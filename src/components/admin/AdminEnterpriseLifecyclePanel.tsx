"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import {
  deleteEnterpriseByAdmin,
  reactivateEnterpriseByAdmin,
  suspendEnterpriseByAdmin,
} from "@/lib/admin/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  enterpriseId: string;
  slug: string;
  status: string;
};

export function AdminEnterpriseLifecyclePanel({ enterpriseId, slug, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState("");
  const isSuspended = status === "SUSPENDED";

  const onSuspend = async () => {
    if (
      !window.confirm(
        "Suspend this firm? All members will be signed out and lose advisor hub access until the firm is reactivated."
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const result = await suspendEnterpriseByAdmin({ enterpriseId });
      if (result.success) {
        toast.success("Firm suspended");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to suspend firm");
      }
    } finally {
      setLoading(false);
    }
  };

  const onReactivate = async () => {
    setLoading(true);
    try {
      const result = await reactivateEnterpriseByAdmin({ enterpriseId });
      if (result.success) {
        toast.success("Firm reactivated");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to reactivate firm");
      }
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (deleteSlug.trim() !== slug) {
      toast.error(`Type "${slug}" to confirm deletion.`);
      return;
    }
    if (
      !window.confirm(
        "Permanently delete this firm? Memberships and firm billing are removed. Advisor accounts remain but are unlinked from the firm."
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const result = await deleteEnterpriseByAdmin({
        enterpriseId,
        confirmSlug: deleteSlug.trim(),
      });
      if (result.success) {
        toast.success("Firm deleted");
        router.push("/admin/enterprises");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to delete firm");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {isSuspended ? (
        <Alert>
          <AlertTitle>Firm suspended</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Members cannot access the advisor hub. Client assignments and data are preserved.
              Reactivate when the contract resumes or billing is restored.
            </p>
            <Button type="button" size="sm" disabled={loading} onClick={() => void onReactivate()}>
              {loading ? "Working…" : "Reactivate firm"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void onSuspend()}
          >
            Suspend firm
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-destructive">Delete firm</p>
          <p className="text-sm text-muted-foreground">
            Removes the enterprise record, team memberships, and firm subscription. Advisor user
            accounts stay active but are no longer linked to this firm. This cannot be undone.
          </p>
        </div>
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="confirm-slug">Type firm slug to confirm</Label>
          <Input
            id="confirm-slug"
            value={deleteSlug}
            onChange={(e) => setDeleteSlug(e.target.value)}
            placeholder={slug}
            autoComplete="off"
            disabled={loading}
          />
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={loading || deleteSlug.trim() !== slug}
          onClick={() => void onDelete()}
        >
          Delete firm permanently
        </Button>
      </div>
    </div>
  );
}
