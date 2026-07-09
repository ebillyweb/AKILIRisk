"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { changeEnterpriseSubdomainByAdmin } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeSubdomainSlugInput } from "@/lib/advisor/subdomain-slug-input";

type Props = {
  enterpriseId: string;
  currentSubdomain: string | null;
  subdomainActive: boolean;
};

/**
 * Platform-admin control to change a firm's white-label subdomain slug (e.g. fix
 * a typo). Existing invite links on the old address stop working, so it confirms
 * first and the firm's owner/admins are notified by the server action.
 */
export function AdminEnterpriseSubdomainPanel({
  enterpriseId,
  currentSubdomain,
  subdomainActive,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const next = value.trim();
  const unchanged = !next || next === currentSubdomain;

  const onChange = async () => {
    if (unchanged || !currentSubdomain) return;
    if (
      !window.confirm(
        `Change this firm's portal address to "${next}"?\n\nAny invitation links already sent with the current address ("${currentSubdomain}") will stop working and must be resent. The firm's owner and admins will be notified.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const result = await changeEnterpriseSubdomainByAdmin({
        enterpriseId,
        subdomain: next,
      });
      if (result.success) {
        toast.success(`Portal address changed to "${result.subdomain}"`);
        setValue("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to change subdomain");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm">
        <span className="text-muted-foreground">Current address: </span>
        {currentSubdomain ? (
          <span className="font-mono">
            {currentSubdomain}
            {!subdomainActive ? " (inactive)" : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">None claimed yet</span>
        )}
      </div>

      <div className="max-w-sm space-y-2">
        <Label htmlFor="new-enterprise-subdomain">New subdomain</Label>
        <Input
          id="new-enterprise-subdomain"
          value={value}
          onChange={(e) => setValue(sanitizeSubdomainSlugInput(e.target.value))}
          placeholder="belvedere"
          autoComplete="off"
          spellCheck={false}
          disabled={loading || !currentSubdomain}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and hyphens. Existing invite links on the
          old address will need to be resent; the firm&apos;s owner and admins
          are notified automatically.
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={loading || unchanged || !currentSubdomain}
        onClick={() => void onChange()}
      >
        {loading ? "Changing…" : "Change subdomain"}
      </Button>
    </div>
  );
}
