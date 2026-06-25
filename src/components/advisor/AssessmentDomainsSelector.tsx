"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectionCheckboxIndicator } from "@/components/advisor/SelectionCheckboxIndicator";
import type { AssessmentDomainOption } from "@/lib/advisor/assessment-domain-option";
import { cn } from "@/lib/utils";

interface AssessmentDomainsSelectorProps {
  domains: AssessmentDomainOption[];
  selectedDomains: string[];
  onChange: (domains: string[]) => void;
  disabled?: boolean;
  recommendedIds?: string[];
  /** Platform pillar count when some methodology pillars are turned off. */
  platformTotal?: number;
  inactiveDomains?: AssessmentDomainOption[];
}

export function AssessmentDomainsSelector({
  domains,
  selectedDomains,
  onChange,
  disabled = false,
  recommendedIds = [],
  platformTotal,
  inactiveDomains = [],
}: AssessmentDomainsSelectorProps) {
  const recommended = new Set(recommendedIds);
  const offeredTotal = domains.length;
  const platformCount = platformTotal ?? offeredTotal;
  const hiddenCount = Math.max(0, platformCount - offeredTotal);

  const selectionLabel =
    selectedDomains.length === 0
      ? "None selected"
      : `${selectedDomains.length} of ${offeredTotal} selected`;

  const allSelected =
    offeredTotal > 0 && selectedDomains.length === offeredTotal;
  const showBulkActions = !disabled && offeredTotal > 1;

  const handleToggle = (areaId: string) => {
    if (disabled) return;
    const isSelected = selectedDomains.includes(areaId);
    onChange(
      isSelected
        ? selectedDomains.filter((id) => id !== areaId)
        : [...selectedDomains, areaId],
    );
  };

  if (domains.length === 0) {
    return (
      <section className="space-y-4" aria-labelledby="assessment-domains-heading">
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          No assessment domains are active in your methodology. Enable pillars under{" "}
          <Link
            href="/advisor/methodology/pillars"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Methodology → Pillar manager
          </Link>{" "}
          before approving or inviting clients.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="assessment-domains-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3
            id="assessment-domains-heading"
            className="text-base font-semibold tracking-tight"
          >
            Assessment domains
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Choose which pillars to include in this client&apos;s assessment (at least
            one required). Showing {offeredTotal} of {platformCount} platform{" "}
            {platformCount === 1 ? "pillar" : "pillars"} active in your methodology.
          </p>
        </div>
        <Badge
          variant={selectedDomains.length > 0 ? "default" : "secondary"}
          className="w-fit shrink-0 tabular-nums normal-case tracking-normal text-xs font-medium"
        >
          {selectionLabel}
        </Badge>
      </div>

      {hiddenCount > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">
              {hiddenCount} platform {hiddenCount === 1 ? "pillar is" : "pillars are"}{" "}
              hidden
            </span>{" "}
            because {hiddenCount === 1 ? "it is" : "they are"} turned off in your
            methodology
            {inactiveDomains.length > 0 ? (
              <>
                {": "}
                <span className="text-foreground">
                  {inactiveDomains.map((d) => d.name).join(", ")}
                </span>
              </>
            ) : null}
            .
          </p>
          <p className="mt-1">
            <Link
              href="/advisor/methodology/pillars"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Open Pillar manager
            </Link>{" "}
            to enable them for client assessments.
          </p>
        </div>
      ) : null}

      {showBulkActions ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={allSelected}
            onClick={() => onChange(domains.map((d) => d.id))}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={selectedDomains.length === 0}
            onClick={() => onChange([])}
          >
            Clear all
          </Button>
        </div>
      ) : null}

      <ul
        className="max-h-[min(28rem,65vh)] divide-y divide-border overflow-y-auto overflow-x-hidden rounded-lg border bg-card"
        role="list"
      >
        {domains.map((area) => {
          const isSelected = selectedDomains.includes(area.id);
          const isRecommended = recommended.has(area.id);

          return (
            <li key={area.id}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => handleToggle(area.id)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors sm:py-3.5",
                  "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isSelected && "bg-primary/5 hover:bg-primary/8",
                  disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                )}
              >
                <SelectionCheckboxIndicator
                  checked={isSelected}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium leading-snug text-foreground">
                      {area.name}
                    </span>
                    {isRecommended ? (
                      <Badge
                        variant="secondary"
                        className="normal-case tracking-normal text-[10px] font-medium"
                      >
                        Suggested
                      </Badge>
                    ) : null}
                  </span>
                  {area.summary ? (
                    <span
                      className={cn(
                        "block text-xs leading-relaxed text-muted-foreground",
                        !isSelected && "line-clamp-2",
                      )}
                    >
                      {area.summary}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-muted-foreground">
        At least one domain is required. The client will only see and complete the
        domains you select.
      </p>
    </section>
  );
}
