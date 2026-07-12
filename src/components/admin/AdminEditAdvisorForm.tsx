"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  restoreAdvisorByAdmin,
  setAdvisorPortalAccessByAdmin,
  softDeleteAdvisorByAdmin,
  updateAdvisorByAdmin,
  type UpdateAdvisorInput,
} from "@/lib/admin/actions";
import { AdminTestAccountToggle } from "@/components/admin/AdminTestAccountToggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email("Invalid email").max(255),
  firmName: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  jobTitle: z.string().max(200).optional(),
  licenseNumber: z.string().max(100).optional(),
  bio: z.string().max(2000).optional(),
  specializationsStr: z.string().max(500).optional(),
});

type FormData = z.infer<typeof formSchema>;

type AdvisorSubscription = {
  status: string;
  tier: string;
  billingCycle: string;
  currentPeriodEnd: Date | string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
};

type Advisor = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  deletedAt: Date | string | null;
  isTestAccount: boolean;
  advisorPortalAccessEnabled: boolean;
  subscription: AdvisorSubscription | null;
  advisorProfile: {
    id: string;
    firmName: string | null;
    licenseNumber: string | null;
    specializations: string[];
    phone: string | null;
    jobTitle: string | null;
    bio: string | null;
  } | null;
};

function humanizeEnum(value: string) {
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatPeriodEnd(value: Date | string) {
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    return format(d, "PP");
  } catch {
    return "—";
  }
}

interface AdminEditAdvisorFormProps {
  advisor: Advisor;
  /** When true, portal enablement requires a Stripe subscription id on the subscription row. */
  billingFeaturesEnabled: boolean;
  /** Whether the admin is allowed to turn portal access on (subscription rules satisfied). */
  canEnablePortalAccess: boolean;
  superAdmin: boolean;
}

export function AdminEditAdvisorForm({
  advisor,
  billingFeaturesEnabled,
  canEnablePortalAccess,
  superAdmin,
}: AdminEditAdvisorFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountActionLoading, setAccountActionLoading] = useState(false);
  const [portalEnabled, setPortalEnabled] = useState(
    advisor.advisorPortalAccessEnabled !== false
  );
  const [portalSaving, setPortalSaving] = useState(false);
  const profile = advisor.advisorProfile;
  const sub = advisor.subscription;
  const isDeactivated = Boolean(advisor.deletedAt);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: advisor.name ?? "",
      firstName: advisor.firstName ?? "",
      lastName: advisor.lastName ?? "",
      email: advisor.email,
      firmName: profile?.firmName ?? "",
      phone: profile?.phone ?? "",
      jobTitle: profile?.jobTitle ?? "",
      licenseNumber: profile?.licenseNumber ?? "",
      bio: profile?.bio ?? "",
      specializationsStr: profile?.specializations?.join(", ") ?? "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const specializations = data.specializationsStr
        ? data.specializationsStr.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const payload: UpdateAdvisorInput = {
        userId: advisor.id,
        name: data.name || undefined,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        email: data.email,
        firmName: data.firmName || undefined,
        phone: data.phone || undefined,
        jobTitle: data.jobTitle || undefined,
        licenseNumber: data.licenseNumber || undefined,
        bio: data.bio || undefined,
        specializations: specializations.length ? specializations : undefined,
      };
      const result = await updateAdvisorByAdmin(payload);
      if (result.success) {
        toast.success("Advisor updated");
        router.push("/admin/advisors");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update advisor");
      }
    } catch {
      toast.error("Failed to update advisor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRestore = async () => {
    setAccountActionLoading(true);
    try {
      const result = await restoreAdvisorByAdmin({ userId: advisor.id });
      if (result.success) {
        toast.success("Advisor restored");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to restore advisor");
      }
    } catch {
      toast.error("Failed to restore advisor");
    } finally {
      setAccountActionLoading(false);
    }
  };

  const onDeactivate = async () => {
    const ok = window.confirm(
      "Deactivate this advisor? They will be signed out, unable to sign in, client assignments will show as inactive until you restore them, and prior client links will become active again on restore."
    );
    if (!ok) return;
    setAccountActionLoading(true);
    try {
      const result = await softDeleteAdvisorByAdmin({ userId: advisor.id });
      if (result.success) {
        toast.success("Advisor deactivated");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to deactivate advisor");
      }
    } catch {
      toast.error("Failed to deactivate advisor");
    } finally {
      setAccountActionLoading(false);
    }
  };

  const onPortalAccessChange = async (checked: boolean | "indeterminate") => {
    if (isDeactivated) return;
    if (checked === "indeterminate") return;
    setPortalSaving(true);
    try {
      const result = await setAdvisorPortalAccessByAdmin({
        userId: advisor.id,
        enabled: checked,
      });
      if (result.success) {
        setPortalEnabled(checked);
        toast.success(checked ? "Portal access enabled" : "Portal access disabled");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update portal access");
      }
    } catch {
      toast.error("Failed to update portal access");
    } finally {
      setPortalSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {isDeactivated ? (
        <Alert>
          <AlertTitle>Account deactivated</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              This advisor cannot sign in and has no active sessions. Client assignments were set
              inactive; restoring the account reactivates those assignments.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={accountActionLoading}
              onClick={() => void onRestore()}
            >
              {accountActionLoading ? "Restoring…" : "Restore advisor"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {superAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Test account</CardTitle>
            <CardDescription>
              Test advisors stay fully operational but are excluded from platform dashboards and
              analytics (control center, analytics, risk signals).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {advisor.isTestAccount ? (
              <p className="text-sm text-muted-foreground">This advisor is marked as a test account.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                This advisor counts toward production dashboards.
              </p>
            )}
            <AdminTestAccountToggle
              userId={advisor.id}
              isTestAccount={advisor.isTestAccount}
              accountLabel="advisor"
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Subscription and portal access</CardTitle>
          <CardDescription>
            Subscription data is read-only from the database (Stripe checkout and webhooks update
            it). Portal access can only be turned on when the subscription qualifies: active or past
            due, or grace period while the current period end is still in the future (once that date
            passes, grace no longer qualifies).
            {billingFeaturesEnabled
              ? " With billing enabled, a Stripe subscription id is required for active and similar statuses; grace period before current period end can qualify without one."
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Subscription status</dt>
              <dd className="mt-1 font-medium">
                {sub ? humanizeEnum(sub.status) : "No subscription"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plan tier</dt>
              <dd className="mt-1 font-medium">{sub ? humanizeEnum(sub.tier) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Billing cycle</dt>
              <dd className="mt-1 font-medium">
                {sub ? humanizeEnum(sub.billingCycle) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current period ends</dt>
              <dd className="mt-1 font-medium">
                {sub ? formatPeriodEnd(sub.currentPeriodEnd) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cancel at period end</dt>
              <dd className="mt-1 font-medium">{sub ? (sub.cancelAtPeriodEnd ? "Yes" : "No") : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Stripe subscription</dt>
              <dd className="mt-1 font-mono text-xs break-all">
                {sub?.stripeSubscriptionId ?? "—"}
              </dd>
            </div>
          </dl>
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <Checkbox
              id="portal-access"
              checked={portalEnabled}
              disabled={
                isDeactivated ||
                portalSaving ||
                (!portalEnabled && !canEnablePortalAccess)
              }
              onCheckedChange={onPortalAccessChange}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="portal-access" className="cursor-pointer font-medium leading-snug">
                Advisor portal access enabled
              </Label>
              <p className="text-xs text-muted-foreground">
                When unchecked, this advisor cannot use the advisor hub or advisor APIs. Turning
                access on requires a qualifying subscription. With billing enabled, new paid access
                normally comes from Stripe checkout; grace period before current period end still
                qualifies even if no Stripe id is stored on the row yet. After period end, grace
                does not qualify.
              </p>
              {!portalEnabled && !canEnablePortalAccess ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {billingFeaturesEnabled
                    ? "Complete an active Stripe subscription for this advisor before enabling portal access."
                    : "Fix the subscription so it is qualifying (including grace period before period end) before enabling portal access."}
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <fieldset disabled={isDeactivated} className="min-w-0 space-y-6 border-0 p-0">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" {...register("firstName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" {...register("lastName")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advisor profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firmName">Firm name</Label>
              <Input id="firmName" {...register("firmName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" {...register("jobTitle")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">License number</Label>
              <Input id="licenseNumber" {...register("licenseNumber")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="specializationsStr">Specializations (comma-separated)</Label>
            <Input
              id="specializationsStr"
              placeholder="e.g. financial-planning, risk-assessment"
              {...register("specializationsStr")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={3} {...register("bio")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting || isDeactivated}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/advisors">Cancel</Link>
        </Button>
      </div>
      </fieldset>
    </form>

      {!isDeactivated ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Deactivation signs the advisor out everywhere, blocks sign-in, and sets their client
              assignments inactive until you restore this account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="destructive"
              disabled={accountActionLoading}
              onClick={() => void onDeactivate()}
            >
              {accountActionLoading ? "Working…" : "Deactivate advisor"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
