"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEnterpriseByAdmin,
  type CreateEnterpriseInput,
} from "@/lib/admin/actions";
import {
  SELF_SERVE_TIERS,
  TIER_CATALOG,
  TIER_DISPLAY_NAME,
} from "@/lib/billing/tier-catalog";
import {
  ENTERPRISE_DEFAULT_CLIENT_LIMIT,
  ENTERPRISE_DEFAULT_PER_ADVISOR_CLIENT_LIMIT,
  ENTERPRISE_DEFAULT_SEAT_LIMIT,
} from "@/lib/enterprise/constants";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(20)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  ownerUserId: z.string().min(1, "Select an owner"),
  moduleTier: z.enum(["ESSENTIALS", "PROFESSIONAL", "BUSINESS", "PLATINUM"]),
  seatLimit: z.string().optional(),
  clientLimit: z.string().optional(),
  perAdvisorClientLimit: z.string().optional(),
  paymentMethod: z.enum(["WIRE", "CARD"]),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]),
});

type FormData = z.infer<typeof formSchema>;

type OwnerOption = {
  id: string;
  email: string;
  name: string | null;
  advisorProfile: { firmName: string | null } | null;
};

export function AdminCreateEnterpriseForm({ owners }: { owners: OwnerOption[] }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      ownerUserId: "",
      moduleTier: "PROFESSIONAL",
      seatLimit: String(ENTERPRISE_DEFAULT_SEAT_LIMIT),
      clientLimit: String(ENTERPRISE_DEFAULT_CLIENT_LIMIT),
      perAdvisorClientLimit: String(ENTERPRISE_DEFAULT_PER_ADVISOR_CLIENT_LIMIT),
      paymentMethod: "WIRE",
      billingCycle: "ANNUAL",
    },
  });

  const paymentMethod = watch("paymentMethod");
  const moduleTier = watch("moduleTier");
  const billingCycle = watch("billingCycle");

  const parseOptionalLimit = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const payload: CreateEnterpriseInput = {
        name: data.name,
        slug: data.slug,
        ownerUserId: data.ownerUserId,
        moduleTier: data.moduleTier,
        seatLimit: parseOptionalLimit(data.seatLimit, ENTERPRISE_DEFAULT_SEAT_LIMIT),
        clientLimit: parseOptionalLimit(data.clientLimit, ENTERPRISE_DEFAULT_CLIENT_LIMIT),
        perAdvisorClientLimit: parseOptionalLimit(
          data.perAdvisorClientLimit,
          ENTERPRISE_DEFAULT_PER_ADVISOR_CLIENT_LIMIT
        ),
        paymentMethod: data.paymentMethod,
        billingCycle: data.billingCycle,
        stripeCustomerId:
          data.paymentMethod === "CARD" ? data.stripeCustomerId?.trim() || undefined : undefined,
        stripeSubscriptionId:
          data.paymentMethod === "CARD"
            ? data.stripeSubscriptionId?.trim() || undefined
            : undefined,
      };
      const result = await createEnterpriseByAdmin(payload);
      if (!result.success) {
        toast.error(result.error ?? "Failed to create enterprise.");
        return;
      }
      toast.success("Enterprise firm created.");
      router.push("/admin/enterprises");
      router.refresh();
    } catch {
      toast.error("Failed to create enterprise.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/enterprises" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Enterprises
        </Link>
      </Button>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Provision Enterprise firm</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="enterprise-name">Firm name</Label>
              <Input id="enterprise-name" {...register("name")} />
              {errors.name ? (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="enterprise-slug">Subdomain slug</Label>
              <Input id="enterprise-slug" placeholder="acme-wealth" {...register("slug")} />
              {errors.slug ? (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="enterprise-owner">Owner (advisor)</Label>
              <Select
                value={watch("ownerUserId") || undefined}
                onValueChange={(value) =>
                  setValue("ownerUserId", value, { shouldValidate: true })
                }
              >
                <SelectTrigger id="enterprise-owner">
                  <SelectValue placeholder="Select advisor owner" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name ?? owner.email}
                      {owner.advisorProfile?.firmName
                        ? ` · ${owner.advisorProfile.firmName}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.ownerUserId ? (
                <p className="text-sm text-destructive">{errors.ownerUserId.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="module-tier">Module tier</Label>
                <Select
                  value={moduleTier}
                  onValueChange={(value) =>
                    setValue(
                      "moduleTier",
                      value as FormData["moduleTier"],
                      { shouldValidate: true }
                    )
                  }
                >
                  <SelectTrigger id="module-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SELF_SERVE_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {TIER_DISPLAY_NAME[tier]} — {TIER_CATALOG[tier].modules}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.moduleTier ? (
                  <p className="text-sm text-destructive">{errors.moduleTier.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing-cycle">Billing cycle</Label>
                <Select
                  value={billingCycle}
                  onValueChange={(value) =>
                    setValue(
                      "billingCycle",
                      value as FormData["billingCycle"],
                      { shouldValidate: true }
                    )
                  }
                >
                  <SelectTrigger id="billing-cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="ANNUAL">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="seat-limit">Seat limit</Label>
                <Input id="seat-limit" type="number" min={1} {...register("seatLimit")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-limit">Firm client limit</Label>
                <Input id="client-limit" type="number" min={1} {...register("clientLimit")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="per-advisor-limit">Per-advisor limit</Label>
                <Input
                  id="per-advisor-limit"
                  type="number"
                  min={1}
                  {...register("perAdvisorClientLimit")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) =>
                  setValue("paymentMethod", value as "WIRE" | "CARD", { shouldValidate: true })
                }
              >
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WIRE">Wire transfer (offline)</SelectItem>
                  <SelectItem value="CARD">Credit card (Stripe)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === "CARD" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stripe-customer-id">Stripe customer ID</Label>
                  <Input id="stripe-customer-id" {...register("stripeCustomerId")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stripe-subscription-id">Stripe subscription ID</Label>
                  <Input id="stripe-subscription-id" {...register("stripeSubscriptionId")} />
                </div>
              </div>
            ) : null}

            <Button type="submit" disabled={isSubmitting || owners.length === 0}>
              {isSubmitting ? "Creating…" : "Create enterprise"}
            </Button>
            {owners.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No eligible advisor owners found. Advisors must not already belong to another firm.
                Any personal subscription is cancelled automatically when the firm is created.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
