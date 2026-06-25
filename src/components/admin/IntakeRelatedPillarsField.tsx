import { Checkbox } from "@/components/ui/checkbox";
import type { PillarCatalogEntry } from "@/lib/methodology/pillar-catalog";
import { sortPillarCatalog } from "@/lib/methodology/pillar-catalog";
import { cn } from "@/lib/utils";

type IntakeRelatedPillarsFieldProps = {
  pillars: PillarCatalogEntry[];
  defaultSelected: string[];
  disabled?: boolean;
};

export function IntakeRelatedPillarsField({
  pillars,
  defaultSelected,
  disabled = false,
}: IntakeRelatedPillarsFieldProps) {
  const selected = new Set(defaultSelected);
  const areas = sortPillarCatalog(pillars);

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium leading-none">
        Related assessment pillars
      </legend>
      <p className="text-xs text-muted-foreground">
        Used to suggest which domains to include when an advisor approves intake.
        Select zero or more.
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border bg-card">
        {areas.map((area) => {
          const isChecked = selected.has(area.id);
          return (
            <li key={area.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-4 py-3 text-left",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <Checkbox
                  name="relatedPillarIds"
                  value={area.id}
                  defaultChecked={isChecked}
                  disabled={disabled}
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-medium">{area.name}</span>
                  <span className="block text-xs text-muted-foreground line-clamp-2">
                    {area.summary}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
