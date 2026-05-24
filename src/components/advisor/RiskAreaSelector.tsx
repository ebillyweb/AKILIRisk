"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RISK_AREAS } from "@/lib/advisor/types";
import { cn } from "@/lib/utils";

interface RiskAreaSelectorProps {
  selectedAreas: string[];
  onChange: (areas: string[]) => void;
  disabled?: boolean;
}

export function RiskAreaSelector({
  selectedAreas,
  onChange,
  disabled = false,
}: RiskAreaSelectorProps) {
  const handleAreaToggle = (areaId: string) => {
    if (disabled) return;

    const isCurrentlySelected = selectedAreas.includes(areaId);
    const newSelectedAreas = isCurrentlySelected
      ? selectedAreas.filter((id) => id !== areaId)
      : [...selectedAreas, areaId];

    onChange(newSelectedAreas);
  };

  const selectionLabel =
    selectedAreas.length === 0
      ? "None selected"
      : `${selectedAreas.length} of ${RISK_AREAS.length} selected`;

  return (
    <section className="space-y-4" aria-labelledby="focus-risk-areas-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3
            id="focus-risk-areas-heading"
            className="text-base font-semibold tracking-tight"
          >
            Focus risk areas
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Choose which pillars need a deeper assessment for this client.
          </p>
        </div>
        <Badge
          variant={selectedAreas.length > 0 ? "default" : "secondary"}
          className="shrink-0 tabular-nums"
        >
          {selectionLabel}
        </Badge>
      </div>

      <ul
        className="divide-y divide-border overflow-hidden rounded-lg border bg-card"
        role="list"
      >
        {RISK_AREAS.map((area) => {
          const isSelected = selectedAreas.includes(area.id);

          return (
            <li key={area.id}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => handleAreaToggle(area.id)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                  "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isSelected && "bg-primary/5 hover:bg-primary/8",
                  disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  disabled={disabled}
                  tabIndex={-1}
                  aria-hidden
                  className="mt-0.5 shrink-0 pointer-events-none"
                />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block text-sm font-medium leading-snug text-foreground">
                    {area.name}
                  </span>
                  <span
                    className={cn(
                      "block text-xs leading-relaxed text-muted-foreground",
                      !isSelected && "line-clamp-2"
                    )}
                  >
                    {area.summary}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-muted-foreground">
        At least one area is required to approve. Selected pillars shape which
        assessment questions the client receives.
      </p>
    </section>
  );
}
