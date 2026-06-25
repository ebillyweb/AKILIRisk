"use client";

import { Badge } from "@/components/ui/badge";
import { SelectionCheckboxIndicator } from "@/components/advisor/SelectionCheckboxIndicator";
import type { AssessmentDomainOption } from "@/lib/advisor/assessment-domain-option";
import { cn } from "@/lib/utils";

interface EmphasisAreasSelectorProps {
  domains: AssessmentDomainOption[];
  includedDomains: string[];
  selectedEmphasis: string[];
  onChange: (areas: string[]) => void;
  disabled?: boolean;
}

export function EmphasisAreasSelector({
  domains,
  includedDomains,
  selectedEmphasis,
  onChange,
  disabled = false,
}: EmphasisAreasSelectorProps) {
  const included = domains.filter((a) => includedDomains.includes(a.id));

  if (included.length === 0) {
    return null;
  }

  const handleToggle = (areaId: string) => {
    if (disabled) return;
    const isSelected = selectedEmphasis.includes(areaId);
    onChange(
      isSelected
        ? selectedEmphasis.filter((id) => id !== areaId)
        : [...selectedEmphasis, areaId],
    );
  };

  const emphasisLabel =
    selectedEmphasis.length === 0
      ? "All included (default)"
      : `${selectedEmphasis.length} emphasized`;

  return (
    <section className="space-y-4" aria-labelledby="emphasis-areas-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <h3
            id="emphasis-areas-heading"
            className="text-base font-semibold tracking-tight"
          >
            Scoring emphasis
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Optional: check specific included domains for extra scoring weight.
            If none are checked, all selected domains are weighted equally.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="w-fit shrink-0 tabular-nums normal-case tracking-normal text-xs font-medium"
        >
          {emphasisLabel}
        </Badge>
      </div>

      <ul
        className="divide-y divide-border overflow-hidden rounded-lg border bg-card"
        role="list"
      >
        {included.map((area) => {
          const isSelected = selectedEmphasis.includes(area.id);

          return (
            <li key={area.id}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => handleToggle(area.id)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                  "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected && "bg-primary/5",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <SelectionCheckboxIndicator
                  checked={isSelected}
                  className="mt-0.5"
                />
                <span className="text-sm font-medium">{area.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
