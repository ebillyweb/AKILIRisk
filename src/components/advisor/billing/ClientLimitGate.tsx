"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";

import {
  clientLimitBillingHref,
  clientLimitUpgradeMessage,
  clientLimitUsageLabel,
  type ClientLimitSnapshot,
} from "@/lib/billing/client-limit";
import { TIER_DISPLAY_NAME } from "@/lib/billing/tier-catalog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ClientLimitLockIcon({ className }: { className?: string }) {
  return (
    <Lock
      className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
      aria-label="Client limit reached"
    />
  );
}

export function ClientLimitUpgradeDialog({
  status,
  open,
  onOpenChange,
}: {
  status: ClientLimitSnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const showStripeUpgrade =
    status.canSelfServeUpgrade && status.suggestedUpgradeTier && !status.isEnterprise;
  const billingHref = clientLimitBillingHref(status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
            <Lock className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <DialogTitle>Client limit reached</DialogTitle>
          <DialogDescription className="text-left leading-6">
            {clientLimitUpgradeMessage(status)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          {showStripeUpgrade ? (
            <Button asChild>
              <Link href={billingHref} onClick={() => onOpenChange(false)}>
                Upgrade to {TIER_DISPLAY_NAME[status.suggestedUpgradeTier!]}
              </Link>
            </Button>
          ) : status.canSelfServeUpgrade ? (
            <Button asChild>
              <Link href="/advisor/billing" onClick={() => onOpenChange(false)}>
                Open billing
              </Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientLimitBanner({ status }: { status: ClientLimitSnapshot }) {
  const [open, setOpen] = useState(false);
  if (status.canAddClient) return null;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ClientLimitLockIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Client limit reached</p>
            <p className="text-sm text-muted-foreground">{clientLimitUpgradeMessage(status)}</p>
          </div>
        </div>
        {status.canSelfServeUpgrade ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setOpen(true)}
          >
            Upgrade plan
          </Button>
        ) : null}
      </div>
      <ClientLimitUpgradeDialog status={status} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ClientLimitUsageMeter({
  status,
  className,
  compact = false,
}: {
  status: ClientLimitSnapshot;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pct = Math.min(100, status.limit > 0 ? (status.currentCount / status.limit) * 100 : 0);
  const atLimit = !status.canAddClient;

  return (
    <>
      <button
        type="button"
        className={cn(
          "w-full rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-left transition-colors",
          atLimit ? "hover:bg-muted/40" : "cursor-default",
          className
        )}
        onClick={atLimit ? () => setOpen(true) : undefined}
        disabled={!atLimit}
        aria-label={
          atLimit
            ? `${clientLimitUsageLabel(status.currentCount, status.limit)} — upgrade required`
            : clientLimitUsageLabel(status.currentCount, status.limit)
        }
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-foreground">
            {compact ? "Clients" : "Active clients"}
          </span>
          <span className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
            {status.currentCount}/{status.limit}
            {atLimit ? <ClientLimitLockIcon /> : null}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={status.currentCount}
          aria-valuemin={0}
          aria-valuemax={status.limit}
        >
          <div
            className={cn("h-full transition-all", atLimit ? "bg-destructive" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>
      {atLimit ? (
        <ClientLimitUpgradeDialog status={status} open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}

export function GatedClientAddButton({
  status,
  href,
  children,
  className,
  variant = "default",
  size = "sm",
}: {
  status: ClientLimitSnapshot;
  href: string;
  children: ReactNode;
  className?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
}) {
  const [open, setOpen] = useState(false);

  if (status.canAddClient) {
    return (
      <Button asChild variant={variant} size={size} className={className}>
        <Link href={href}>{children}</Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <ClientLimitLockIcon className="mr-2 size-3.5 text-current" />
        {children}
      </Button>
      <ClientLimitUpgradeDialog status={status} open={open} onOpenChange={setOpen} />
    </>
  );
}
