"use client";

import { useState, useCallback, useTransition } from "react";
import { Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OverlayFieldEditor } from "./OverlayFieldEditor";
import { ComposedPreviewSheet } from "./ComposedPreviewSheet";
import { RECOMMENDATION_FIELD_POLICIES } from "@/lib/recommendations/override-policy";
import { upsertEnterpriseOverlay } from "@/lib/actions/enterprise-solution-actions";
import type { InternalLink, PlaybookStep } from "./OverlayFieldEditor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceRecommendationData = {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: number;
  estimatedCost: string | null;
  timeframe: string | null;
  provider: string | null;
  expectedOutcome: string | null;
  tags: string[];
  shortDescription: string | null;
  icon: string | null;
  playbook: unknown;
  prerequisites: string[];
  externalUrl: string | null;
};

export type EnterpriseOverlayData = {
  id: string;
  serviceRecommendationId: string;
  isRequired: boolean;
  priorityAdjustment: number | null;
  complianceDisclosures: string | null;
  customGuidance: string | null;
  internalLinks: unknown;
  costOverride: string | null;
  timeframeOverride: string | null;
  providerOverride: string | null;
  notes: string | null;
  additionalPlaybook: unknown;
  isActive: boolean;
};

type OverlayFormState = {
  isRequired: boolean;
  priorityAdjustment: number;
  complianceDisclosures: string;
  customGuidance: string;
  internalLinks: InternalLink[];
  costOverride: string;
  timeframeOverride: string;
  providerOverride: string;
  notes: string;
  additionalPlaybook: PlaybookStep[];
};

function emptyOverlayForm(): OverlayFormState {
  return {
    isRequired: false,
    priorityAdjustment: 0,
    complianceDisclosures: "",
    customGuidance: "",
    internalLinks: [],
    costOverride: "",
    timeframeOverride: "",
    providerOverride: "",
    notes: "",
    additionalPlaybook: [],
  };
}

function overlayToForm(overlay: EnterpriseOverlayData): OverlayFormState {
  return {
    isRequired: overlay.isRequired,
    priorityAdjustment: overlay.priorityAdjustment ?? 0,
    complianceDisclosures: overlay.complianceDisclosures ?? "",
    customGuidance: overlay.customGuidance ?? "",
    internalLinks: (overlay.internalLinks as InternalLink[]) ?? [],
    costOverride: overlay.costOverride ?? "",
    timeframeOverride: overlay.timeframeOverride ?? "",
    providerOverride: overlay.providerOverride ?? "",
    notes: overlay.notes ?? "",
    additionalPlaybook: parsePlaybookSteps(overlay.additionalPlaybook),
  };
}

function parsePlaybookSteps(json: unknown): PlaybookStep[] {
  if (!json || typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  if (!Array.isArray(obj.steps)) return [];
  return (obj.steps as Record<string, unknown>[])
    .filter((s) => typeof s.title === "string")
    .map((s, i) => ({
      title: s.title as string,
      description: (s.description as string) ?? undefined,
      estimatedDuration: (s.estimatedDuration as string) ?? undefined,
      sortOrder: typeof s.sortOrder === "number" ? s.sortOrder : i,
    }));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type GuidanceCustomizationProps = {
  recommendations: ServiceRecommendationData[];
  overlays: EnterpriseOverlayData[];
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GuidanceCustomization({
  recommendations,
  overlays,
}: GuidanceCustomizationProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<OverlayFormState>(emptyOverlayForm());
  const [isDirty, setIsDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const overlayMap = new Map(overlays.map((o) => [o.serviceRecommendationId, o]));
  const selected = recommendations.find((r) => r.id === selectedId) ?? null;
  const existingOverlay = selectedId ? overlayMap.get(selectedId) ?? null : null;

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      setSaveMessage(null);
      const overlay = overlayMap.get(id);
      if (overlay) {
        setForm(overlayToForm(overlay));
      } else {
        setForm(emptyOverlayForm());
      }
      setIsDirty(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlays]
  );

  const updateField = useCallback(
    <K extends keyof OverlayFormState>(field: K, value: OverlayFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
      setSaveMessage(null);
    },
    []
  );

  const handleSave = useCallback(() => {
    if (!selectedId) return;
    startTransition(async () => {
      const result = await upsertEnterpriseOverlay({
        serviceRecommendationId: selectedId,
        isRequired: form.isRequired,
        priorityAdjustment: form.priorityAdjustment,
        complianceDisclosures: form.complianceDisclosures || undefined,
        customGuidance: form.customGuidance || undefined,
        internalLinks: form.internalLinks.length > 0 ? form.internalLinks : undefined,
        costOverride: form.costOverride || undefined,
        timeframeOverride: form.timeframeOverride || undefined,
        providerOverride: form.providerOverride || undefined,
        notes: form.notes || undefined,
        additionalPlaybook:
          form.additionalPlaybook.length > 0
            ? { steps: form.additionalPlaybook }
            : undefined,
      });
      if (result.success) {
        setIsDirty(false);
        setSaveMessage("Overlay saved successfully.");
      } else {
        setSaveMessage(`Error: ${result.error}`);
      }
    });
  }, [selectedId, form]);

  // Group recommendations by category
  const categories = [...new Set(recommendations.map((r) => r.category))];

  return (
    <div className="flex gap-0 rounded-lg border border-border/70 overflow-hidden min-h-[600px]">
      {/* Left panel: catalog browse (40%) */}
      <div className="w-[40%] shrink-0 bg-muted/40 overflow-y-auto border-r border-border/60">
        <div className="p-4 space-y-4">
          {categories.map((category) => (
            <div key={category} className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {category}
              </h3>
              {recommendations
                .filter((r) => r.category === category)
                .map((rec) => {
                  const hasOverlay = overlayMap.has(rec.id);
                  const isSelected = rec.id === selectedId;
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => handleSelect(rec.id)}
                      className={`w-full text-left rounded-md border p-3 transition-colors ${
                        isSelected
                          ? "border-border bg-background shadow-sm"
                          : "border-transparent hover:bg-background/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-foreground line-clamp-1">
                          {rec.name}
                        </span>
                        {hasOverlay && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            Overlay
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {rec.shortDescription ?? rec.description}
                      </p>
                    </button>
                  );
                })}
            </div>
          ))}

          {recommendations.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No platform recommendations</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Platform recommendations will appear here once added by a platform admin.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Vertical separator */}
      <Separator orientation="vertical" className="h-auto" />

      {/* Right panel: overlay editor (60%) */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex h-full items-center justify-center p-8">
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Select a platform recommendation from the catalog to view its definition and configure your enterprise overlay.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Platform Definition section (read-only) */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Platform Definition</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    Platform -- Protected
                  </Badge>
                </div>
                <CardDescription>
                  Immutable platform recommendation. Enterprise overlays layer on top.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Protected fields displayed read-only */}
                <OverlayFieldEditor
                  fieldName="name"
                  label="Name"
                  platformValue={selected.name}
                  value={null}
                  onChange={() => {}}
                  tier="PROTECTED"
                  fieldType="text"
                />
                <OverlayFieldEditor
                  fieldName="description"
                  label="Description"
                  platformValue={selected.description}
                  value={null}
                  onChange={() => {}}
                  tier="PROTECTED"
                  fieldType="textarea"
                />
                <OverlayFieldEditor
                  fieldName="expectedOutcome"
                  label="Expected Outcome"
                  platformValue={selected.expectedOutcome}
                  value={null}
                  onChange={() => {}}
                  tier="PROTECTED"
                  fieldType="textarea"
                />
                {selected.tags.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Tags</span>
                    <div className="flex flex-wrap gap-1">
                      {selected.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selected.prerequisites.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Prerequisites</span>
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                      {selected.prerequisites.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enterprise Overlay section (editable) */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Enterprise Overlay</CardTitle>
                  {isDirty && (
                    <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
                  )}
                </div>
                <CardDescription>
                  {existingOverlay
                    ? "Customize your firm's overlay for this recommendation."
                    : "No overlay configured. Add firm guidance, preferred vendors, or compliance requirements using the fields on the right."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Configurable fields */}
                <OverlayFieldEditor
                  fieldName="costOverride"
                  label="Estimated Cost"
                  platformValue={selected.estimatedCost}
                  value={form.costOverride}
                  onChange={(v) => updateField("costOverride", v as string)}
                  tier={RECOMMENDATION_FIELD_POLICIES["estimatedCost"] ?? "CONFIGURABLE"}
                  fieldType="text"
                />
                <OverlayFieldEditor
                  fieldName="timeframeOverride"
                  label="Timeframe"
                  platformValue={selected.timeframe}
                  value={form.timeframeOverride}
                  onChange={(v) => updateField("timeframeOverride", v as string)}
                  tier={RECOMMENDATION_FIELD_POLICIES["timeframe"] ?? "CONFIGURABLE"}
                  fieldType="text"
                />
                <OverlayFieldEditor
                  fieldName="providerOverride"
                  label="Provider"
                  platformValue={selected.provider}
                  value={form.providerOverride}
                  onChange={(v) => updateField("providerOverride", v as string)}
                  tier={RECOMMENDATION_FIELD_POLICIES["provider"] ?? "CONFIGURABLE"}
                  fieldType="text"
                />

                <Separator />

                {/* Addition fields */}
                <OverlayFieldEditor
                  fieldName="customGuidance"
                  label="Custom Guidance"
                  value={form.customGuidance}
                  onChange={(v) => updateField("customGuidance", v as string)}
                  tier="ADDITION"
                  fieldType="textarea"
                />
                <OverlayFieldEditor
                  fieldName="complianceDisclosures"
                  label="Compliance Disclosures"
                  value={form.complianceDisclosures}
                  onChange={(v) => updateField("complianceDisclosures", v as string)}
                  tier="ADDITION"
                  fieldType="textarea"
                />
                <OverlayFieldEditor
                  fieldName="notes"
                  label="Notes"
                  value={form.notes}
                  onChange={(v) => updateField("notes", v as string)}
                  tier={RECOMMENDATION_FIELD_POLICIES["notes"] ?? "ADDITION"}
                  fieldType="textarea"
                />
                <OverlayFieldEditor
                  fieldName="isRequired"
                  label="Required"
                  value={form.isRequired}
                  onChange={(v) => updateField("isRequired", v as boolean)}
                  tier="ADDITION"
                  fieldType="checkbox"
                />
                <OverlayFieldEditor
                  fieldName="priorityAdjustment"
                  label="Priority Adjustment"
                  value={form.priorityAdjustment}
                  onChange={(v) => updateField("priorityAdjustment", v as number)}
                  tier="ADDITION"
                  fieldType="number"
                />
                <OverlayFieldEditor
                  fieldName="internalLinks"
                  label="Internal Links"
                  value={form.internalLinks}
                  onChange={(v) => updateField("internalLinks", v as InternalLink[])}
                  tier="ADDITION"
                  fieldType="links"
                />
                <OverlayFieldEditor
                  fieldName="additionalPlaybook"
                  label="Additional Playbook Steps"
                  value={form.additionalPlaybook}
                  onChange={(v) => updateField("additionalPlaybook", v as PlaybookStep[])}
                  tier="ADDITION"
                  fieldType="playbook"
                />

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={isPending || !isDirty}
                  >
                    {isPending ? "Saving..." : "Save Overlay"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPreviewOpen(true)}
                    className="gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    Preview Composed Result
                  </Button>
                </div>

                {saveMessage && (
                  <p
                    className={`text-sm ${
                      saveMessage.startsWith("Error")
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {saveMessage}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Composed preview sheet */}
      {selected && (
        <ComposedPreviewSheet
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          recommendation={selected}
          overlayFormValues={form}
        />
      )}
    </div>
  );
}
