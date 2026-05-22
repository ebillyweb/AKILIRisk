"use client";

import { Copy, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ShareableInvitationLinkAlertProps = {
  url: string;
  reason?: string;
  title?: string;
  onDismiss?: () => void;
};

export function ShareableInvitationLinkAlert({
  url,
  reason,
  title = "Invitation created — email was not sent",
  onDismiss,
}: ShareableInvitationLinkAlertProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-2 min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {title}
          </p>
          {reason && (
            <p className="text-xs text-amber-700 dark:text-amber-300">{reason}</p>
          )}
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Copy this link and share it with your client:
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={url}
              className="font-mono text-xs bg-white dark:bg-background"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Link copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {onDismiss && (
            <Button type="button" variant="secondary" size="sm" onClick={onDismiss}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
