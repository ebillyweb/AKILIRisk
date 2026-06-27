"use client";

import { Lock, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { OverrideTier } from "@/lib/asset-catalog/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InternalLink = { url: string; label: string };
export type PlaybookStep = {
  title: string;
  description?: string;
  estimatedDuration?: string;
  sortOrder: number;
};

type OverlayFieldEditorProps = {
  /** Field machine name (e.g. "customGuidance", "costOverride"). */
  fieldName: string;
  /** Human-readable field label. */
  label: string;
  /** Current platform value (read-only reference). */
  platformValue?: string | null;
  /** Current overlay value (editable). */
  value: unknown;
  /** Callback when overlay value changes. */
  onChange: (value: unknown) => void;
  /** Override tier from RECOMMENDATION_FIELD_POLICIES. */
  tier: OverrideTier;
  /** Field type hint. */
  fieldType:
    | "text"
    | "textarea"
    | "number"
    | "checkbox"
    | "links"
    | "playbook";
};

// ---------------------------------------------------------------------------
// Tier badge
// ---------------------------------------------------------------------------

function TierBadge({ tier }: { tier: OverrideTier }) {
  switch (tier) {
    case "PROTECTED":
      return (
        <Badge variant="secondary" className="gap-1 text-xs">
          <Lock className="h-3 w-3" />
          Platform -- Protected
        </Badge>
      );
    case "CONFIGURABLE":
      return (
        <Badge variant="outline" className="text-xs">
          Configurable
        </Badge>
      );
    case "ADDITION":
      return (
        <Badge variant="secondary" className="text-xs">
          Enterprise Addition
        </Badge>
      );
  }
}

// ---------------------------------------------------------------------------
// Sub-editors
// ---------------------------------------------------------------------------

function LinksEditor({
  value,
  onChange,
}: {
  value: InternalLink[];
  onChange: (v: InternalLink[]) => void;
}) {
  const addLink = () => onChange([...value, { url: "", label: "" }]);
  const removeLink = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof InternalLink, v: string) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.map((link, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1 space-y-1">
            <Input
              placeholder="Label"
              value={link.label}
              onChange={(e) => update(i, "label", e.target.value)}
              className="text-sm"
            />
            <Input
              placeholder="https://..."
              value={link.url}
              onChange={(e) => update(i, "url", e.target.value)}
              className="text-sm"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeLink(i)}
            className="mt-1 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Remove link</span>
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addLink} className="gap-1">
        <Plus className="h-3 w-3" /> Add link
      </Button>
    </div>
  );
}

function PlaybookEditor({
  value,
  onChange,
}: {
  value: PlaybookStep[];
  onChange: (v: PlaybookStep[]) => void;
}) {
  const addStep = () =>
    onChange([
      ...value,
      { title: "", description: "", estimatedDuration: "", sortOrder: value.length },
    ]);
  const removeStep = (i: number) =>
    onChange(value.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, sortOrder: idx })));
  const update = (i: number, field: keyof PlaybookStep, v: string | number) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.map((step, i) => (
        <div key={i} className="rounded-md border border-border/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => removeStep(i)}
            >
              <Trash2 className="h-3 w-3" />
              <span className="sr-only">Remove step</span>
            </Button>
          </div>
          <Input
            placeholder="Step title"
            value={step.title}
            onChange={(e) => update(i, "title", e.target.value)}
            className="text-sm"
          />
          <Textarea
            placeholder="Description (optional)"
            value={step.description ?? ""}
            onChange={(e) => update(i, "description", e.target.value)}
            rows={2}
            className="text-sm"
          />
          <Input
            placeholder="Estimated duration (optional)"
            value={step.estimatedDuration ?? ""}
            onChange={(e) => update(i, "estimatedDuration", e.target.value)}
            className="text-sm"
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addStep} className="gap-1">
        <Plus className="h-3 w-3" /> Add playbook step
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OverlayFieldEditor({
  fieldName: _fieldName,
  label,
  platformValue,
  value,
  onChange,
  tier,
  fieldType,
}: OverlayFieldEditorProps) {
  // PROTECTED fields: show platform value with lock, no edit controls
  if (tier === "PROTECTED") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          <TierBadge tier={tier} />
        </div>
        <p className="text-sm text-muted-foreground rounded-md bg-muted/40 px-3 py-2">
          {platformValue || <span className="italic">Not set</span>}
        </p>
      </div>
    );
  }

  // CONFIGURABLE and ADDITION fields: render editable controls
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        <TierBadge tier={tier} />
      </div>

      {/* Show platform reference for CONFIGURABLE fields */}
      {tier === "CONFIGURABLE" && platformValue && (
        <p className="text-xs text-muted-foreground">
          Platform value: <span className="font-medium">{platformValue}</span>
        </p>
      )}

      {/* Render control based on fieldType */}
      {fieldType === "textarea" && (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            tier === "CONFIGURABLE"
              ? `Override platform value...`
              : `Enter ${label.toLowerCase()}...`
          }
          rows={3}
          className="text-sm"
        />
      )}

      {fieldType === "text" && (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            tier === "CONFIGURABLE"
              ? `Override platform value...`
              : `Enter ${label.toLowerCase()}...`
          }
          className="text-sm"
        />
      )}

      {fieldType === "number" && (
        <Input
          type="number"
          min={-10}
          max={10}
          value={(value as number) ?? 0}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="text-sm w-24"
        />
      )}

      {fieldType === "checkbox" && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={(value as boolean) ?? false}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          <span className="text-sm text-muted-foreground">Required for all firm advisors</span>
        </div>
      )}

      {fieldType === "links" && (
        <LinksEditor
          value={(value as InternalLink[]) ?? []}
          onChange={onChange}
        />
      )}

      {fieldType === "playbook" && (
        <PlaybookEditor
          value={(value as PlaybookStep[]) ?? []}
          onChange={onChange}
        />
      )}
    </div>
  );
}
