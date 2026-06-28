"use client";

import { useState, useTransition } from "react";
import type { AdvisorQuestionSource } from "@prisma/client";
import type { RecommendationCondition } from "@/lib/admin/recommendation-rule-schemas";
import {
  parseStoredTriggerConditions,
  type RulePickerQuestion,
} from "@/lib/admin/recommendation-rule-ui";
import { defaultCustomRecommendationConditions } from "@/lib/methodology/advisor-recommendation-starter";
import {
  canDeleteAdvisorQuestion,
  isEnterpriseAdvisorQuestion,
  isPlatformAdvisorQuestion,
} from "@/lib/methodology/advisor-question-policy";
import { TriggerConditionsBuilder } from "@/components/admin/TriggerConditionsBuilder";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type RecommendationRuleEditorRow = {
  id: string;
  sourceKind: AdvisorQuestionSource;
  name: string;
  priority: number;
  isActive: boolean;
  triggerConditions: unknown;
  serviceRecommendationId: string | null;
  serviceName: string | null;
};

type ServiceOption = {
  id: string;
  name: string;
  category: string;
};

type RuleActions = {
  updateRule: (
    ruleId: string,
    data: {
      name?: string;
      priority?: number;
      isActive?: boolean;
      triggerConditions?: RecommendationCondition[];
    },
  ) => Promise<{ success: boolean; error?: string }>;
  createRule: (
    pillarSlug: string,
    data: {
      name: string;
      serviceRecommendationId: string;
      priority?: number;
      triggerConditions?: RecommendationCondition[];
    },
  ) => Promise<{ success: boolean; error?: string }>;
  deleteRule: (ruleId: string) => Promise<{ success: boolean; error?: string }>;
};

function sourceBadgeLabel(sourceKind: AdvisorQuestionSource): string {
  if (sourceKind === "CUSTOM") return "Custom";
  if (sourceKind === "ENTERPRISE") return "Firm default";
  return "Platform base";
}

function RuleCard({
  rule,
  questionOptions,
  pending,
  onUpdate,
  onDelete,
}: {
  rule: RecommendationRuleEditorRow;
  questionOptions: RulePickerQuestion[];
  pending: boolean;
  onUpdate: RuleActions["updateRule"];
  onDelete: RuleActions["deleteRule"];
}) {
  const [name, setName] = useState(rule.name);
  const [priority, setPriority] = useState(String(rule.priority));
  const [conditions, setConditions] = useState<RecommendationCondition[]>(() =>
    parseStoredTriggerConditions(rule.triggerConditions),
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const canDelete = canDeleteAdvisorQuestion(rule.sourceKind);

  function handleSave() {
    setSaveError(null);
    const trimmedName = name.trim();
    const priorityNum = Number(priority);
    if (!trimmedName) {
      setSaveError("Rule name is required");
      return;
    }
    if (!Number.isFinite(priorityNum)) {
      setSaveError("Priority must be a number");
      return;
    }

    onUpdate(rule.id, {
      name: trimmedName,
      priority: priorityNum,
      triggerConditions: conditions,
    }).then((result) => {
      if (!result.success) {
        setSaveError(result.error ?? "Could not save rule");
      }
    });
  }

  return (
    <Card className={!rule.isActive ? "opacity-70" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{rule.name}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                rule.sourceKind === "CUSTOM"
                  ? "secondary"
                  : isEnterpriseAdvisorQuestion(rule.sourceKind)
                    ? "secondary"
                    : "outline"
              }
            >
              {sourceBadgeLabel(rule.sourceKind)}
            </Badge>
            {rule.serviceName ? (
              <span className="text-xs text-muted-foreground">{rule.serviceName}</span>
            ) : null}
          </div>
        </div>
        {canDelete ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Remove this custom rule?")) return;
              void onDelete(rule.id);
            }}
          >
            Delete
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox
            defaultChecked={rule.isActive}
            disabled={pending}
            onCheckedChange={(checked) => {
              void onUpdate(rule.id, { isActive: checked === true });
            }}
          />
          <Label>Active for new intakes</Label>
          <FieldHelp helpKey="advisor-rule-active" triggerLabel="Active for new intakes" />
        </div>

        {isPlatformAdvisorQuestion(rule.sourceKind) ? (
          <p className="text-xs text-muted-foreground">
            Platform base rules can be customized for your clients but not deleted.
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <LabelWithHelp htmlFor={`name-${rule.id}`} helpKey="rule-name">
              Rule name
            </LabelWithHelp>
            <Input
              id={`name-${rule.id}`}
              value={name}
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <LabelWithHelp htmlFor={`priority-${rule.id}`} helpKey="rule-priority">
              Priority
            </LabelWithHelp>
            <Input
              id={`priority-${rule.id}`}
              type="number"
              value={priority}
              disabled={pending}
              onChange={(event) => setPriority(event.target.value)}
            />
          </div>
        </div>

        <TriggerConditionsBuilder
          value={conditions}
          onChange={setConditions}
          questions={questionOptions}
          disabled={pending}
        />

        {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}

        <Button type="button" size="sm" disabled={pending} onClick={handleSave}>
          Save rule
        </Button>
      </CardContent>
    </Card>
  );
}

function CreateRuleCard({
  pillarSlug,
  services,
  questionOptions,
  pending,
  createDescription,
  onCreate,
}: {
  pillarSlug: string;
  services: ServiceOption[];
  questionOptions: RulePickerQuestion[];
  pending: boolean;
  createDescription: string;
  onCreate: RuleActions["createRule"];
}) {
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [priority, setPriority] = useState("1");
  const [conditions, setConditions] = useState<RecommendationCondition[]>(
    defaultCustomRecommendationConditions(pillarSlug),
  );
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    const trimmedName = name.trim();
    const priorityNum = Number(priority);
    if (!trimmedName) {
      setError("Rule name is required");
      return;
    }
    if (!serviceId) {
      setError("Choose a service recommendation");
      return;
    }

    onCreate(pillarSlug, {
      name: trimmedName,
      serviceRecommendationId: serviceId,
      priority: Number.isFinite(priorityNum) ? priorityNum : 1,
      triggerConditions: conditions,
    }).then((result) => {
      if (result.success) {
        setName("");
        setPriority("1");
        setConditions(defaultCustomRecommendationConditions(pillarSlug));
        setError(null);
      } else {
        setError(result.error ?? "Could not add rule");
      }
    });
  }

  return (
    <Card data-tour="rule-create">
      <CardHeader>
        <CardTitle className="text-base">Add custom rule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{createDescription}</p>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <LabelWithHelp htmlFor="custom-rule-name" helpKey="rule-name">
              Rule name
            </LabelWithHelp>
            <Input
              id="custom-rule-name"
              value={name}
              disabled={pending}
              placeholder="e.g. Cyber incident response review"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <LabelWithHelp htmlFor="custom-rule-service" helpKey="rule-service">
              Service recommendation
            </LabelWithHelp>
            <Select
              value={serviceId || undefined}
              onValueChange={setServiceId}
              disabled={pending || services.length === 0}
            >
              <SelectTrigger id="custom-rule-service">
                <SelectValue placeholder="Choose a service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} ({service.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <LabelWithHelp htmlFor="custom-rule-priority" helpKey="rule-priority">
              Priority
            </LabelWithHelp>
            <Input
              id="custom-rule-priority"
              type="number"
              value={priority}
              disabled={pending}
              onChange={(event) => setPriority(event.target.value)}
            />
          </div>
        </div>

        <TriggerConditionsBuilder
          value={conditions}
          onChange={setConditions}
          questions={questionOptions}
          disabled={pending}
        />

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <Button
          type="button"
          size="sm"
          disabled={pending || services.length === 0}
          onClick={handleCreate}
        >
          Add rule
        </Button>
      </CardContent>
    </Card>
  );
}

function isCustomRule(sourceKind: AdvisorQuestionSource): boolean {
  return sourceKind === "CUSTOM";
}

function RulesList({
  rules,
  questionOptions,
  pending,
  onUpdate,
  onDelete,
  emptyMessage,
}: {
  rules: RecommendationRuleEditorRow[];
  questionOptions: RulePickerQuestion[];
  pending: boolean;
  onUpdate: RuleActions["updateRule"];
  onDelete: RuleActions["deleteRule"];
  emptyMessage: string;
}) {
  if (rules.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <RuleCard
          key={rule.id}
          rule={rule}
          questionOptions={questionOptions}
          pending={pending}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export function RecommendationRulesEditorShared({
  pillarSlug,
  rules,
  services,
  questionOptions,
  createDescription,
  actions,
}: {
  pillarSlug: string;
  rules: RecommendationRuleEditorRow[];
  services: ServiceOption[];
  questionOptions: RulePickerQuestion[];
  createDescription: string;
  actions: RuleActions;
}) {
  const [pending, startTransition] = useTransition();

  const wrappedActions: RuleActions = {
    updateRule: (ruleId, data) =>
      new Promise((resolve) => {
        startTransition(async () => {
          resolve(await actions.updateRule(ruleId, data));
        });
      }),
    createRule: (slug, data) =>
      new Promise((resolve) => {
        startTransition(async () => {
          resolve(await actions.createRule(slug, data));
        });
      }),
    deleteRule: (ruleId) =>
      new Promise((resolve) => {
        startTransition(async () => {
          resolve(await actions.deleteRule(ruleId));
        });
      }),
  };

  const platformRules = rules.filter((rule) => !isCustomRule(rule.sourceKind));
  const customRules = rules.filter((rule) => isCustomRule(rule.sourceKind));

  return (
    <Tabs defaultValue="platform" className="gap-4" data-tour="rules-existing">
      <TabsList variant="line" className="w-full justify-start">
        <TabsTrigger value="platform">
          Platform
          <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
            {platformRules.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="custom">
          Custom
          <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
            {customRules.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="platform" className="mt-0 space-y-4">
        <p className="text-sm text-muted-foreground">
          Platform base rules ship with AkiliRisk. Edit triggers or deactivate them for your
          clients — they cannot be deleted. Firm defaults also appear here when your organization
          provides them.
        </p>
        <RulesList
          rules={platformRules}
          questionOptions={questionOptions}
          pending={pending}
          onUpdate={wrappedActions.updateRule}
          onDelete={wrappedActions.deleteRule}
          emptyMessage="No platform rules for this pillar yet. Check back after defaults sync, or add a custom rule."
        />
      </TabsContent>

      <TabsContent value="custom" className="mt-0 space-y-4">
        <RulesList
          rules={customRules}
          questionOptions={questionOptions}
          pending={pending}
          onUpdate={wrappedActions.updateRule}
          onDelete={wrappedActions.deleteRule}
          emptyMessage="No custom rules for this pillar yet."
        />

        <CreateRuleCard
          pillarSlug={pillarSlug}
          services={services}
          questionOptions={questionOptions}
          pending={pending}
          createDescription={createDescription}
          onCreate={wrappedActions.createRule}
        />
      </TabsContent>
    </Tabs>
  );
}
