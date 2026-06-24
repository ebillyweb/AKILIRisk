"use client";

import { useTransition } from "react";
import type { AdvisorQuestionSource } from "@prisma/client";
import {
  createAdvisorRecommendationRule,
  deleteAdvisorRecommendationRule,
  updateAdvisorRecommendationRule,
} from "@/lib/actions/methodology-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type RecommendationRuleRow = {
  id: string;
  sourceKind: AdvisorQuestionSource;
  name: string;
  priority: number;
  isActive: boolean;
};

type ServiceOption = {
  id: string;
  name: string;
  category: string;
};

export function RecommendationRulesEditor({
  pillarSlug,
  rules,
  services,
}: {
  pillarSlug: string;
  rules: RecommendationRuleRow[];
  services: ServiceOption[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <Card key={rule.id} className={!rule.isActive ? "opacity-70" : undefined}>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">{rule.name}</CardTitle>
              <Badge variant={rule.sourceKind === "CUSTOM" ? "secondary" : "outline"}>
                {rule.sourceKind === "CUSTOM" ? "Custom" : "Platform base"}
              </Badge>
            </div>
            {rule.sourceKind === "CUSTOM" ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Remove this custom rule?")) return;
                  startTransition(async () => {
                    await deleteAdvisorRecommendationRule(rule.id);
                  });
                }}
              >
                Delete
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                defaultChecked={rule.isActive}
                onCheckedChange={(checked) => {
                  startTransition(async () => {
                    await updateAdvisorRecommendationRule(rule.id, {
                      isActive: checked === true,
                    });
                  });
                }}
              />
              <Label>Active for new intakes</Label>
            </div>
            <form
              className="grid gap-3 md:grid-cols-2"
              action={(formData) => {
                startTransition(async () => {
                  const name = formData.get("name")?.toString();
                  const priority = Number(formData.get("priority"));
                  if (!name?.trim() || !Number.isFinite(priority)) return;
                  await updateAdvisorRecommendationRule(rule.id, {
                    name: name.trim(),
                    priority,
                  });
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor={`name-${rule.id}`}>Rule name</Label>
                <Input id={`name-${rule.id}`} name="name" defaultValue={rule.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`priority-${rule.id}`}>Priority</Label>
                <Input
                  id={`priority-${rule.id}`}
                  name="priority"
                  type="number"
                  defaultValue={rule.priority}
                />
              </div>
              <Button type="submit" size="sm" disabled={pending}>
                Save
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add custom rule</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Custom rules trigger when the pillar is high or critical risk. They apply to new
            intakes only and are visible only to your clients. Platform base rules can be edited
            or deactivated but not removed.
          </p>
          <form
            className="grid gap-3 md:grid-cols-2"
            action={(formData) => {
              startTransition(async () => {
                const name = formData.get("name")?.toString() ?? "";
                const serviceRecommendationId =
                  formData.get("serviceRecommendationId")?.toString() ?? "";
                const priority = Number(formData.get("priority"));
                await createAdvisorRecommendationRule(pillarSlug, {
                  name,
                  serviceRecommendationId,
                  priority: Number.isFinite(priority) ? priority : 1,
                });
              });
            }}
          >
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="custom-rule-name">Rule name</Label>
              <Input id="custom-rule-name" name="name" required placeholder="Rule name" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="custom-rule-service">Service</Label>
              <select
                id="custom-rule-service"
                name="serviceRecommendationId"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                defaultValue={services[0]?.id ?? ""}
              >
                {services.length === 0 ? (
                  <option value="">No active services</option>
                ) : (
                  services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.category})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-rule-priority">Priority</Label>
              <Input
                id="custom-rule-priority"
                name="priority"
                type="number"
                defaultValue={1}
              />
            </div>
            <Button type="submit" size="sm" disabled={pending || services.length === 0}>
              Add rule
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
