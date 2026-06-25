"use client";

import { Badge } from "@/components/ui/badge";
import { SelectionCheckboxIndicator } from "@/components/advisor/SelectionCheckboxIndicator";
import type { AssessmentDomainOption } from "@/lib/advisor/assessment-domain-option";
import { cn } from "@/lib/utils";

interface AssessmentDomainsSelectorProps {
  domains: AssessmentDomainOption[];
  selectedDomains: string[];
  onChange: (domains: string[]) => void;
  disabled?: boolean;
  recommendedIds?: string[];
}

export function AssessmentDomainsSelector({
  domains,
  selectedDomains,
  onChange,
  disabled = false,
  recommendedIds = [],
}: AssessmentDomainsSelectorProps) {
  const recommended = new Set(recommendedIds);

  const handleToggle = (areaId: string) => {
    if (disabled) return;
    const isSelected = selectedDomains.includes(areaId);
    onChange(
      isSelected
        ? selectedDomains.filter((id) => id !== areaId)
        : [...selectedDomains, areaId],
    );
  };

  const selectionLabel =
    selectedDomains.length === 0
      ? "None selected"
      : `${selectedDomains.length} of ${domains.length} selected`;

  if (domains.length === 0) {
    return (
      <section className="space-y-4" aria-labelledby="assessment-domains-heading">
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          No assessment domains are active in your methodology. Enable pillars under{" "}
          <span className="font-medium text-foreground">Methodology → Pillar manager</span>{" "}
          before approving or inviting clients.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="assessment-domains-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3
            id="assessment-domains-heading"
            className="text-base font-semibold tracking-tight"
          >
            Assessment domains
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Choose which pillars to include in this client&apos;s assessment (at least
            one required). Only domains active in your methodology are shown.
          </p>
        </div>
        <Badge
          variant={selectedDomains.length > 0 ? "default" : "secondary"}
          className="shrink-0 tabular-nums"
        >
          {selectionLabel}
        </Badge>
      </div>

      <ul
        className="divide-y divide-border overflow-hidden rounded-lg border bg-card"
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
                  "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
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
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
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
