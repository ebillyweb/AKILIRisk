"use client";

import { useTransition } from "react";
import { updateAdvisorPillarOverride } from "@/lib/actions/methodology-actions";
import { DEFAULT_RISK_THRESHOLDS } from "@/lib/assessment/governance-rubric";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PillarRow = {
  pillarId: string;
  slug: string;
  canonicalName: string;
  isActive: boolean;
  displayName: string | null;
  weight: number;
  displayOrder: number;
  threshold: { lowMin: number; mediumMin: number; highMin: number } | null;
};

function thresholdFor(pillar: PillarRow) {
  const raw = pillar.threshold;
  if (
    raw &&
    typeof raw === "object" &&
    "lowMin" in raw &&
    "mediumMin" in raw &&
    "highMin" in raw
  ) {
    return raw as { lowMin: number; mediumMin: number; highMin: number };
  }
  return DEFAULT_RISK_THRESHOLDS;
}

export function PillarManagerForm({ pillars }: { pillars: PillarRow[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {pillars.map((pillar) => (
        <Card key={pillar.pillarId}>
          <CardHeader>
            <CardTitle className="text-base">{pillar.canonicalName}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id={`active-${pillar.slug}`}
                defaultChecked={pillar.isActive}
                onCheckedChange={(checked) => {
                  startTransition(async () => {
                    await updateAdvisorPillarOverride(pillar.slug, {
                      isActive: checked === true,
                    });
                  });
                }}
              />
              <Label htmlFor={`active-${pillar.slug}`}>Active for new intakes</Label>
              <FieldHelp helpKey="pillar-active" triggerLabel="Active for new intakes" />
            </div>
            <div className="space-y-2">
              <LabelWithHelp htmlFor={`name-${pillar.slug}`} helpKey="pillar-display-name">
                Display name
              </LabelWithHelp>
              <form
                action={(formData) => {
                  startTransition(async () => {
                    await updateAdvisorPillarOverride(pillar.slug, {
                      displayName: formData.get("displayName")?.toString() || null,
                    });
                  });
                }}
              >
                <Input
                  id={`name-${pillar.slug}`}
                  name="displayName"
                  defaultValue={pillar.displayName ?? ""}
                  placeholder={pillar.canonicalName}
                />
                <Button type="submit" size="sm" className="mt-2" disabled={pending}>
                  Save label
                </Button>
              </form>
            </div>
            <div className="space-y-2">
              <LabelWithHelp htmlFor={`weight-${pillar.slug}`} helpKey="pillar-weight">
                Weight
              </LabelWithHelp>
              <form
                action={(formData) => {
                  startTransition(async () => {
                    const weight = Number(formData.get("weight"));
                    if (!Number.isFinite(weight)) return;
                    await updateAdvisorPillarOverride(pillar.slug, { weight });
                  });
                }}
              >
                <Input
                  id={`weight-${pillar.slug}`}
                  name="weight"
                  type="number"
                  step="0.5"
                  defaultValue={pillar.weight}
                />
                <Button type="submit" size="sm" className="mt-2" disabled={pending}>
                  Save weight
                </Button>
              </form>
            </div>
            <div className="space-y-2 md:col-span-2">
              <LabelWithHelp helpKey="pillar-thresholds">
                Risk thresholds (0–100 resilience %)
              </LabelWithHelp>
              <form
                className="grid gap-3 sm:grid-cols-3"
                action={(formData) => {
                  startTransition(async () => {
                    const lowMin = Number(formData.get("lowMin"));
                    const mediumMin = Number(formData.get("mediumMin"));
                    const highMin = Number(formData.get("highMin"));
                    if (
                      !Number.isFinite(lowMin) ||
                      !Number.isFinite(mediumMin) ||
                      !Number.isFinite(highMin)
                    ) {
                      return;
                    }
                    await updateAdvisorPillarOverride(pillar.slug, {
                      threshold: { lowMin, mediumMin, highMin },
                    });
                  });
                }}
              >
                {(["lowMin", "mediumMin", "highMin"] as const).map((field) => (
                  <div key={field} className="space-y-1">
                    <LabelWithHelp htmlFor={`${field}-${pillar.slug}`} helpKey="pillar-threshold-cutoff">
                      {field}
                    </LabelWithHelp>
                    <Input
                      id={`${field}-${pillar.slug}`}
                      name={field}
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={thresholdFor(pillar)[field]}
                    />
                  </div>
                ))}
                <Button type="submit" size="sm" className="sm:col-span-3" disabled={pending}>
                  Save thresholds
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
