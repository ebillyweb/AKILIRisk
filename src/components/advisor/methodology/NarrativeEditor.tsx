"use client";

import { useTransition } from "react";
import { updateAdvisorPillarNarrative } from "@/lib/actions/methodology-actions";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type NarrativeFormProps = {
  pillarSlug: string;
  allNegative: string[];
  allYes: string[];
  midBand: { critical: string[]; high: string[]; medium: string[]; low: string[] };
};

function lines(value: string[]) {
  return value.join("\n");
}

function parseLines(raw: string) {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function NarrativeEditor({
  pillarSlug,
  allNegative,
  allYes,
  midBand,
}: NarrativeFormProps) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-6"
      action={(formData) => {
        startTransition(async () => {
          await updateAdvisorPillarNarrative(pillarSlug, {
            allNegative: parseLines(formData.get("allNegative")?.toString() ?? ""),
            allYes: parseLines(formData.get("allYes")?.toString() ?? ""),
            midBand: {
              critical: parseLines(formData.get("critical")?.toString() ?? ""),
              high: parseLines(formData.get("high")?.toString() ?? ""),
              medium: parseLines(formData.get("medium")?.toString() ?? ""),
              low: parseLines(formData.get("low")?.toString() ?? ""),
            },
          });
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All-negative band</CardTitle>
        </CardHeader>
        <CardContent>
          <LabelWithHelp htmlFor="allNegative" helpKey="narrative-all-negative">
            One recommendation per line
          </LabelWithHelp>
          <Textarea
            id="allNegative"
            name="allNegative"
            defaultValue={lines(allNegative)}
            rows={6}
            className="mt-2"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All-yes band</CardTitle>
        </CardHeader>
        <CardContent>
          <LabelWithHelp helpKey="narrative-all-yes">One recommendation per line</LabelWithHelp>
          <Textarea name="allYes" defaultValue={lines(allYes)} rows={6} className="mt-2" />
        </CardContent>
      </Card>
      {(["critical", "high", "medium", "low"] as const).map((tier) => (
        <Card key={tier}>
          <CardHeader>
            <CardTitle className="text-base capitalize">{tier} mid-band</CardTitle>
          </CardHeader>
          <CardContent>
            <LabelWithHelp helpKey="narrative-mid-band">
              {tier} tier — one recommendation per line
            </LabelWithHelp>
            <Textarea name={tier} defaultValue={lines(midBand[tier])} rows={4} className="mt-2" />
          </CardContent>
        </Card>
      ))}
      <Button type="submit" disabled={pending}>
        Save narratives
      </Button>
    </form>
  );
}
