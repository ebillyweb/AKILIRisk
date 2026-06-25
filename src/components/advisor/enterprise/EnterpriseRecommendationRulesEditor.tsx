"use client";

import { useTransition } from "react";
import type { AdvisorQuestionSource } from "@prisma/client";
import {
  createEnterpriseRecommendationRule,
  deleteEnterpriseRecommendationRule,
  updateEnterpriseRecommendationRule,
} from "@/lib/actions/enterprise-recommendation-actions";
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

function sourceLabel(sourceKind: AdvisorQuestionSource): string {
  switch (sourceKind) {
    case "CUSTOM":
      return "Enterprise custom";
    case "PLATFORM":
      return "Platform base";
    default:
      return sourceKind;
  }
}

export function EnterpriseRecommendationRulesEditor({
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
                {sourceLabel(rule.sourceKind)}
              </Badge>
            </div>
            {rule.sourceKind === "CUSTOM" ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Remove this custom enterprise rule? Member advisor copies will be deactivated.")) return;
                  startTransition(async () => {
                    await deleteEnterpriseRecommendationRule(rule.id);
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
                    await updateEnterpriseRecommendationRule(rule.id, {
                      isActive: checked === true,
                    });
                  });
                }}
              />
              <Label>Active for firm advisors</Label>
            </div>
            <form
              className="grid gap-3 md:grid-cols-2"
              action={(formData) => {
                startTransition(async () => {
                  const name = formData.get("name")?.toString();
                  const priority = Number(formData.get("priority"));
                  if (!name?.trim() || !Number.isFinite(priority)) return;
                  await updateEnterpriseRecommendationRule(rule.id, {
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
          <CardTitle className="text-base">Add firm-wide custom rule</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Custom enterprise rules are automatically synced to all firm member advisors.
            Members inherit enterprise rules as defaults and can further adjust them.
            Platform base rules can be edited or deactivated but not removed.
          </p>
          <form
            className="grid gap-3 md:grid-cols-2"
            action={(formData) => {
              startTransition(async () => {
                const name = formData.get("name")?.toString() ?? "";
                const serviceRecommendationId =
                  formData.get("serviceRecommendationId")?.toString() ?? "";
                const priority = Number(formData.get("priority"));
                await createEnterpriseRecommendationRule(pillarSlug, {
                  name,
                  serviceRecommendationId,
                  priority: Number.isFinite(priority) ? priority : 1,
                });
              });
            }}
          >
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ent-rule-name">Rule name</Label>
              <Input id="ent-rule-name" name="name" required placeholder="Rule name" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ent-rule-service">Service</Label>
              <select
                id="ent-rule-service"
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
              <Label htmlFor="ent-rule-priority">Priority</Label>
              <Input
                id="ent-rule-priority"
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
