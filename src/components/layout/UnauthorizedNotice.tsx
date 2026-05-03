"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Dismissible banner shown when a user lands on /dashboard or /advisor with
 * `?error=unauthorized` - the (protected)/{admin,advisor} layouts add the
 * param when redirecting away on a role mismatch, and the dashboard
 * role-router preserves it through the second hop. Dismissing only updates
 * local state; navigating elsewhere drops the param naturally.
 */
export function UnauthorizedNotice({ error }: { error: string | undefined }) {
  const [dismissed, setDismissed] = useState(false);

  if (error !== "unauthorized" || dismissed) {
    return null;
  }

  return (
    <Alert variant="warning" className="relative pr-12">
      <AlertTitle>Access denied</AlertTitle>
      <AlertDescription>
        You don&apos;t have permission to view that page. You&apos;ve been
        redirected to your home.
      </AlertDescription>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss notice"
      >
        <X className="size-4" />
      </button>
    </Alert>
  );
}
