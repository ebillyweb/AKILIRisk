"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  PILLAR_OPTIONS,
  type PillarThresholdRow,
} from "@/lib/admin/recommendation-rule-ui";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PillarThresholdsBuilderProps = {
  value: PillarThresholdRow[];
  onChange: (next: PillarThresholdRow[]) => void;
  disabled?: boolean;
  error?: string | null;
};

function defaultRow(): PillarThresholdRow {
  return {
    pillarId: PILLAR_OPTIONS[0]?.value ?? "cyber-digital",
    min: 1.8,
    max: 2.4,
  };
}

export function PillarThresholdsBuilder({
  value,
  onChange,
  disabled = false,
  error,
}: PillarThresholdsBuilderProps) {
  return (
    <div className="space-y-4">
      <div>
        <LabelWithHelp helpKey="rule-pillar-thresholds">Risk domain score ranges (optional)</LabelWithHelp>
        <p className="mt-1 text-xs text-muted-foreground">
          Reference ranges for documentation. These do not change whether the rule fires today.
        </p>
      </div>

      {value.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          No reference ranges added.
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((row, index) => (
            <div key={index} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
              <div className="space-y-2">
                <LabelWithHelp htmlFor={`threshold-pillar-${index}`} helpKey="threshold-pillar">
                  Pillar
                </LabelWithHelp>
                <Select
                  value={row.pillarId}
                  onValueChange={(pillarId) =>
                    onChange(
                      value.map((item, i) => (i === index ? { ...item, pillarId } : item)),
                    )
                  }
                  disabled={disabled}
                >
                  <SelectTrigger id={`threshold-pillar-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PILLAR_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor={`threshold-min-${index}`} helpKey="threshold-min-max">
                  Minimum score
                </LabelWithHelp>
                <Input
                  id={`threshold-min-${index}`}
                  type="number"
                  step="0.1"
                  value={row.min}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange(
                      value.map((item, i) =>
                        i === index ? { ...item, min: Number(e.target.value) } : item,
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor={`threshold-max-${index}`} helpKey="threshold-min-max">
                  Maximum score
                </LabelWithHelp>
                <Input
                  id={`threshold-max-${index}`}
                  type="number"
                  step="0.1"
                  value={row.max}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange(
                      value.map((item, i) =>
                        i === index ? { ...item, max: Number(e.target.value) } : item,
                      ),
                    )
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  aria-label={`Remove threshold ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onChange([...value, defaultRow()])}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add reference range
      </Button>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
