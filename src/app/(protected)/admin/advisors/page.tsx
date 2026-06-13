import type { CSSProperties } from "react";
import Link from "next/link";
import { AlertTriangle, CreditCard, Package, Pencil, UserPlus } from "lucide-react";
import {
  advisorBrandInitials,
  pickAdvisorBrandPrimary,
  pickAdvisorBrandSecondary,
} from "@/components/admin/admin-advisor-list-styles";
import { getAdminAdvisorHubDisplay } from "@/lib/admin/advisor-hub-display";
import { isBillingEnabled } from "@/lib/billing/config";
import { getAdvisorsForAdmin, type AdvisorsAdminScope } from "@/lib/admin/queries";
import { looksLikeAdvisorBrandingS3Url } from "@/lib/branding/advisor-logo-display";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function humanizeEnumToken(value: string) {
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export type AdvisorsAdminFilter = AdvisorsAdminScope | "attention";

export default async function AdminAdvisorsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter: AdvisorsAdminFilter =
    sp.filter === "all"
      ? "all"
      : sp.filter === "attention"
        ? "attention"
        : "active";
  const billingEnabled = isBillingEnabled();
  const allAdvisors = await getAdvisorsForAdmin({
    scope: filter === "all" ? "all" : "active",
  });

  const advisorsWithStatus = allAdvisors.map((a) => ({
    advisor: a,
    hub: getAdminAdvisorHubDisplay({
      deletedAt: a.deletedAt,
      advisorPortalAccessEnabled: a.advisorPortalAccessEnabled,
      billingEnabled,
      subscription: a.subscription,
    }),
  }));

  const advisors =
    filter === "attention"
      ? advisorsWithStatus.filter(({ hub }) => hub.needsAttention)
      : advisorsWithStatus;

  const attentionCount = advisorsWithStatus.filter(({ hub }) => hub.needsAttention).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">
            Advisor accounts{" "}
            <span className="font-normal text-muted-foreground">({advisors.length})</span>
          </h1>
          <div className="flex flex-wrap gap-2 text-sm">
            <Button
              variant={filter === "active" ? "default" : "outline"}
              size="sm"
              className="h-8"
              asChild
            >
              <Link href="/admin/advisors">Active</Link>
            </Button>
            <Button
              variant={filter === "attention" ? "default" : "outline"}
              size="sm"
              className="h-8"
              asChild
            >
              <Link href="/admin/advisors?filter=attention">
                Needs attention
                {attentionCount > 0 ? ` (${attentionCount})` : ""}
              </Link>
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              className="h-8"
              asChild
            >
              <Link href="/admin/advisors?filter=all">All</Link>
            </Button>
          </div>
        </div>
        <Button asChild className="shrink-0 self-start sm:self-auto">
          <Link href="/admin/advisors/new" className="inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add advisor
          </Link>
        </Button>
      </div>

      {filter !== "attention" && attentionCount > 0 ? (
        <Alert variant="warning">
          <AlertTriangle className="size-4" />
          <AlertTitle>
            {attentionCount} advisor{attentionCount === 1 ? "" : "s"} need attention
          </AlertTitle>
          <AlertDescription>
            These accounts cannot use the advisor hub (expired grace, no subscription, portal
            off, or deactivated).{" "}
            <Link href="/admin/advisors?filter=attention" className="font-medium underline">
              View needs attention
            </Link>
            <Link href="/admin/advisors?filter=attention" className="font-medium underline">
              View needs attention
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {advisors.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-sm text-muted-foreground">
              {filter === "attention"
                ? "No advisors need attention right now."
                : "No advisors found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {advisors.map(({ advisor: a, hub }) => {
            const isDeactivated = Boolean(a.deletedAt);
            const isWhiteLabel = Boolean(a.subscription?.whiteLabel);
            const profile = a.advisorProfile;
            const primary = pickAdvisorBrandPrimary(profile?.primaryColor, profile?.accentColor);
            const secondary = pickAdvisorBrandSecondary(
              profile?.secondaryColor,
              profile?.primaryColor,
              profile?.accentColor
            );
            const rawLogo = profile?.logoUrl?.trim() || "";
            const showPublicLogo =
              Boolean(rawLogo) && !looksLikeAdvisorBrandingS3Url(rawLogo) && /^https?:\/\//i.test(rawLogo);
            const hasS3Logo = Boolean(profile?.logoS3Key);
            const adminLogoSrc = `/api/admin/advisors/${a.id}/logo`;
            const initials = profile
              ? advisorBrandInitials(profile.brandName, profile.firmName, a.name ?? a.email)
              : (a.name ?? a.email).slice(0, 2).toUpperCase();

            const hasBrandColors = Boolean(primary);
            const brandDisplayName =
              profile?.brandName?.trim() || profile?.firmName?.trim() || null;

            const cardSurfaceStyle: CSSProperties | undefined =
              !isDeactivated && hasBrandColors && primary
                ? {
                    borderColor: `color-mix(in srgb, ${primary} ${isWhiteLabel ? 42 : 28}%, hsl(var(--border)))`,
                    backgroundImage: secondary
                      ? `linear-gradient(155deg, color-mix(in srgb, ${primary} ${isWhiteLabel ? 18 : 10}%, transparent) 0%, color-mix(in srgb, ${secondary} ${isWhiteLabel ? 14 : 8}%, transparent) 52%, transparent 88%)`
                      : `linear-gradient(155deg, color-mix(in srgb, ${primary} ${isWhiteLabel ? 18 : 10}%, transparent) 0%, transparent 78%)`,
                  }
                : undefined;

            const topBarBackground =
              !isDeactivated && hasBrandColors && primary
                ? secondary && secondary !== primary
                  ? `linear-gradient(90deg, ${primary}, ${secondary})`
                  : `linear-gradient(90deg, ${primary}, color-mix(in srgb, ${primary} 45%, white))`
                : undefined;

            return (
              <Card
                key={a.id}
                className={cn(
                  "overflow-hidden transition-shadow",
                  isDeactivated
                    ? "border border-dashed border-muted-foreground/35 bg-muted/30 shadow-none"
                    : !hub.hubAllowed
                      ? "border-2 border-amber-500/45 bg-amber-500/[0.03] shadow-sm"
                      : hasBrandColors
                        ? "border-2 shadow-sm"
                        : "border shadow-sm",
                  !isDeactivated && isWhiteLabel && "shadow-md"
                )}
                style={cardSurfaceStyle}
                aria-disabled={isDeactivated ? true : undefined}
              >
                {isDeactivated ? (
                  <div
                    className="h-1.5 w-full shrink-0 bg-muted-foreground/25"
                    aria-hidden
                  />
                ) : !hub.hubAllowed ? (
                  <div
                    className="h-1.5 w-full shrink-0 bg-amber-500/80"
                    aria-hidden
                  />
                ) : topBarBackground ? (
                  <div
                    className="h-1.5 w-full shrink-0"
                    style={{ background: topBarBackground }}
                    aria-hidden
                  />
                ) : null}
                <CardHeader className="flex flex-col gap-4 space-y-0 pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    {showPublicLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- public CDN URLs only
                      <img
                        src={rawLogo}
                        alt=""
                        className={cn(
                          "size-14 shrink-0 rounded-xl border object-contain p-1 shadow-sm",
                          isDeactivated
                            ? "border-muted-foreground/25 bg-muted/50 opacity-60 grayscale"
                            : "border-border/60 bg-background"
                        )}
                      />
                    ) : hasS3Logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- admin-authenticated same-origin logo route
                      <img
                        src={adminLogoSrc}
                        alt=""
                        className={cn(
                          "size-14 shrink-0 rounded-xl border object-contain p-1 shadow-sm",
                          isDeactivated
                            ? "border-muted-foreground/25 bg-muted/50 opacity-60 grayscale"
                            : "border-border/60 bg-background"
                        )}
                      />
                    ) : (
                      <div
                        className={cn(
                          "flex size-14 shrink-0 items-center justify-center rounded-xl border text-sm font-bold leading-none shadow-inner",
                          isDeactivated
                            ? "border-muted-foreground/30 bg-muted text-muted-foreground"
                            : "border-border/50 text-white"
                        )}
                        style={
                          isDeactivated
                            ? undefined
                            : {
                                background: secondary
                                  ? `linear-gradient(145deg, ${primary ?? "hsl(var(--primary))"}, ${secondary})`
                                  : (primary ?? "hsl(var(--primary))"),
                              }
                        }
                        aria-hidden
                      >
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <CardTitle
                        className={cn(
                          "text-base leading-snug",
                          isDeactivated && "text-muted-foreground"
                        )}
                      >
                        {a.name ?? a.email}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{a.email}</p>
                      {profile ? (
                        <p
                          className={cn(
                            "pt-1 text-sm",
                            isDeactivated && "text-muted-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "font-medium",
                              isDeactivated ? "text-muted-foreground" : "text-foreground"
                            )}
                          >
                            {brandDisplayName ?? "Practice"}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {profile._count.clientAssignments} client
                            {profile._count.clientAssignments === 1 ? "" : "s"}
                          </span>
                        </p>
                      ) : (
                        <p className="pt-1 text-sm text-muted-foreground">
                          Practice details not added — open edit to complete setup.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    <div
                      className={cn(
                        "flex flex-wrap items-center gap-2",
                        isDeactivated && "opacity-70"
                      )}
                    >
                      <Badge
                        variant={hub.hubBadgeVariant}
                        className="inline-flex max-w-[min(100%,14rem)] items-center gap-1.5 text-xs font-medium normal-case tracking-normal"
                        title={hub.hubDetail ?? "Advisor hub access"}
                      >
                        <AlertTriangle
                          className={cn(
                            "size-3 shrink-0 opacity-80",
                            hub.hubAllowed && "hidden"
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{hub.hubLabel}</span>
                      </Badge>
                      {a.subscription ? (
                        <Badge
                          variant="outline"
                          className="inline-flex max-w-[min(100%,16rem)] items-center gap-1.5 text-xs font-medium normal-case tracking-normal"
                          title="Subscription plan"
                        >
                          <Package className="size-3 shrink-0 opacity-80" aria-hidden />
                          <span className="truncate">
                            {humanizeEnumToken(a.subscription.tier)}
                            {a.subscription.billingCycle
                              ? ` · ${humanizeEnumToken(a.subscription.billingCycle)}`
                              : ""}
                          </span>
                        </Badge>
                      ) : null}
                      <Badge
                        variant={hub.subscriptionStatusVariant}
                        className="inline-flex max-w-[min(100%,14rem)] items-center gap-1.5 text-xs font-medium normal-case tracking-normal"
                        title={hub.hubDetail ?? "Subscription status"}
                      >
                        <CreditCard className="size-3 shrink-0 opacity-80" aria-hidden />
                        <span className="truncate">{hub.subscriptionStatusLabel}</span>
                      </Badge>
                    </div>
                    <Button variant="outline" size="icon" className="h-9 w-9" asChild>
                      <Link href={`/admin/advisors/${a.id}/edit`} aria-label={`Edit ${a.name ?? a.email}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
