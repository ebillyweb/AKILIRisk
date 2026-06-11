import { Checkbox } from "@/components/ui/checkbox";
import { RISK_AREAS } from "@/lib/advisor/types";
import { cn } from "@/lib/utils";

type IntakeRelatedPillarsFieldProps = {
  defaultSelected: string[];
  disabled?: boolean;
};

export function IntakeRelatedPillarsField({
  defaultSelected,
  disabled = false,
}: IntakeRelatedPillarsFieldProps) {
  const selected = new Set(defaultSelected);

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
        {RISK_AREAS.map((area) => {
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
