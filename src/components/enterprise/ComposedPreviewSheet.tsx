"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ServiceRecommendationData } from "./GuidanceCustomization";
import type { InternalLink, PlaybookStep } from "./OverlayFieldEditor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OverlayFormValues = {
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

type AdvisorCustomizationData = {
  costOverride?: string | null;
  timeframeOverride?: string | null;
  providerOverride?: string | null;
  notes?: string | null;
  additionalPlaybook?: { steps: PlaybookStep[] } | null;
};

type ComposedPreviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendation: ServiceRecommendationData;
  overlayFormValues: OverlayFormValues;
  advisorCustomization?: AdvisorCustomizationData | null;
};

// ---------------------------------------------------------------------------
// Source badge component
// ---------------------------------------------------------------------------

type SourceLayer = "Platform" | "Enterprise" | "Advisor";

function SourceBadge({ source }: { source: SourceLayer }) {
  const styles: Record<SourceLayer, string> = {
    Platform: "bg-muted text-muted-foreground",
    Enterprise: "bg-secondary text-secondary-foreground",
    Advisor: "bg-brand/15 text-foreground",
  };
  return (
    <Badge
      className={`text-xs ${styles[source]}`}
      aria-label={`Source: ${source}`}
    >
      {source}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Compose preview fields client-side from platform + enterprise overlay form + optional advisor data.
 * No server round-trip needed.
 */
function composePreview(
  platform: ServiceRecommendationData,
  overlay: OverlayFormValues,
  advisor?: AdvisorCustomizationData | null
) {
  // Scalar: advisor > enterprise > platform (last non-empty wins)
  const cost =
    advisor?.costOverride || overlay.costOverride || platform.estimatedCost;
  const costSource: SourceLayer = advisor?.costOverride
    ? "Advisor"
    : overlay.costOverride
      ? "Enterprise"
      : "Platform";

  const timeframe =
    advisor?.timeframeOverride || overlay.timeframeOverride || platform.timeframe;
  const timeframeSource: SourceLayer = advisor?.timeframeOverride
    ? "Advisor"
    : overlay.timeframeOverride
      ? "Enterprise"
      : "Platform";

  const provider =
    advisor?.providerOverride || overlay.providerOverride || platform.provider;
  const providerSource: SourceLayer = advisor?.providerOverride
    ? "Advisor"
    : overlay.providerOverride
      ? "Enterprise"
      : "Platform";

  // Playbook: additive from all layers
  const platformSteps = parsePlaybookSteps(platform.playbook);
  const enterpriseSteps = overlay.additionalPlaybook;
  const advisorSteps = advisor?.additionalPlaybook
    ? parsePlaybookSteps(advisor.additionalPlaybook)
    : [];

  type AttributedStep = PlaybookStep & { source: SourceLayer };
  const playbook: AttributedStep[] = [
    ...platformSteps.map((s) => ({ ...s, source: "Platform" as const })),
    ...enterpriseSteps.map((s) => ({ ...s, source: "Enterprise" as const })),
    ...advisorSteps.map((s) => ({ ...s, source: "Advisor" as const })),
  ];
  playbook.sort((a, b) => a.sortOrder - b.sortOrder);

  // Notes: collect from all layers
  const notes: Array<{ text: string; source: SourceLayer }> = [];
  if (overlay.notes) notes.push({ text: overlay.notes, source: "Enterprise" });
  if (advisor?.notes) notes.push({ text: advisor.notes, source: "Advisor" });

  return {
    cost,
    costSource,
    timeframe,
    timeframeSource,
    provider,
    providerSource,
    playbook,
    notes,
    complianceDisclosures: overlay.complianceDisclosures,
    internalLinks: overlay.internalLinks,
    customGuidance: overlay.customGuidance,
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ComposedPreviewSheet({
  open,
  onOpenChange,
  recommendation,
  overlayFormValues,
  advisorCustomization,
}: ComposedPreviewSheetProps) {
  const composed = composePreview(
    recommendation,
    overlayFormValues,
    advisorCustomization
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Composed Preview</SheetTitle>
          <SheetDescription>
            Preview of the fully composed recommendation as seen by advisors and
            clients, with source attribution per field.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Name and description (always platform) */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">
                {recommendation.name}
              </h3>
              <SourceBadge source="Platform" />
            </div>
            <p className="text-sm text-muted-foreground">
              {recommendation.description}
            </p>
            {recommendation.expectedOutcome && (
              <p className="text-sm text-foreground/80 mt-2">
                <span className="font-medium">Expected outcome:</span>{" "}
                {recommendation.expectedOutcome}
              </p>
            )}
          </div>

          <Separator />

          {/* Scalar fields with source attribution */}
          <div className="grid gap-3 sm:grid-cols-2">
            {composed.cost && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Estimated Cost
                  </span>
                  <SourceBadge source={composed.costSource} />
                </div>
                <p className="text-sm">{composed.cost}</p>
              </div>
            )}
            {composed.timeframe && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Timeframe
                  </span>
                  <SourceBadge source={composed.timeframeSource} />
                </div>
                <p className="text-sm">{composed.timeframe}</p>
              </div>
            )}
            {composed.provider && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Provider
                  </span>
                  <SourceBadge source={composed.providerSource} />
                </div>
                <p className="text-sm">{composed.provider}</p>
              </div>
            )}
          </div>

          {/* Playbook */}
          {composed.playbook.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Playbook</h4>
                <ol className="space-y-2">
                  {composed.playbook.map((step, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-md border border-border/50 p-3"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {i + 1}
                      </span>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{step.title}</span>
                          <SourceBadge source={step.source} />
                        </div>
                        {step.description && (
                          <p className="text-xs text-muted-foreground">
                            {step.description}
                          </p>
                        )}
                        {step.estimatedDuration && (
                          <p className="text-xs text-muted-foreground">
                            Duration: {step.estimatedDuration}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}

          {/* Notes */}
          {composed.notes.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Notes</h4>
                {composed.notes.map((note, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <SourceBadge source={note.source} />
                    <p className="text-sm text-muted-foreground">{note.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Custom guidance (enterprise) */}
          {composed.customGuidance && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">Custom Guidance</h4>
                  <SourceBadge source="Enterprise" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {composed.customGuidance}
                </p>
              </div>
            </>
          )}

          {/* Compliance disclosures (enterprise) */}
          {composed.complianceDisclosures && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">Compliance Disclosures</h4>
                  <SourceBadge source="Enterprise" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {composed.complianceDisclosures}
                </p>
              </div>
            </>
          )}

          {/* Internal links (enterprise) */}
          {composed.internalLinks.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">Internal Links</h4>
                  <SourceBadge source="Enterprise" />
                </div>
                <ul className="space-y-1">
                  {composed.internalLinks.map((link, i) => (
                    <li key={i}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand hover:underline"
                      >
                        {link.label || link.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
