"use client";

import { useEffect, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { IntakeQuestion } from "@/lib/intake/types";
import { intakeChoiceOptions, intakeUsesFreeformResponse } from "@/lib/intake/intake-answer-behavior";
import {
  isValidZip,
  MAX_PROPERTY_ENTRIES,
  parseMultiSelectValue,
  parsePropertyListValue,
  serializeMultiSelectValue,
  serializePropertyListValue,
  type PropertyEntry,
} from "@/lib/intake/structured-answer-values";
import { cn } from "@/lib/utils";

/** Shared styling for the full-width, single-column option buttons. */
const OPTION_BUTTON_CLASS =
  "h-auto min-h-10 w-full justify-start whitespace-normal px-4 py-2 text-left";

type IntakeStructuredAnswerProps = {
  question: IntakeQuestion;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function IntakeStructuredAnswer({
  question,
  value,
  onChange,
  disabled = false,
}: IntakeStructuredAnswerProps) {
  const choices = intakeChoiceOptions(question);

  if (question.answerType === "number") {
    return (
      <div className="space-y-2">
        <Label htmlFor="intake-number-answer">Your answer</Label>
        <Input
          id="intake-number-answer"
          type="number"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (question.answerType === "date") {
    return (
      <div className="space-y-2">
        <Label htmlFor="intake-date-answer">Your answer</Label>
        <Input
          id="intake-date-answer"
          type="date"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (question.answerType === "date_mm_yyyy") {
    return (
      <div className="space-y-2">
        <Label htmlFor="intake-month-answer">Your answer</Label>
        <Input
          id="intake-month-answer"
          type="month"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (question.answerType === "multi_select") {
    const selected = new Set(parseMultiSelectValue(value));
    const toggle = (choiceValue: string) => {
      const next = new Set(selected);
      if (next.has(choiceValue)) {
        next.delete(choiceValue);
      } else {
        next.add(choiceValue);
      }
      onChange(serializeMultiSelectValue([...next]));
    };

    return (
      <div className="space-y-3">
        <Label>Select all that apply</Label>
        <div className="flex flex-col gap-2">
          {choices.map((choice) => {
            const isChecked = selected.has(choice.value);
            return (
              <Button
                key={choice.value}
                type="button"
                variant={isChecked ? "default" : "outline"}
                disabled={disabled}
                aria-pressed={isChecked}
                className={cn(OPTION_BUTTON_CLASS, "gap-3")}
                onClick={() => toggle(choice.value)}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    isChecked
                      ? "border-current bg-current/10"
                      : "border-muted-foreground/50",
                  )}
                  aria-hidden
                >
                  {isChecked ? <Check className="size-3" /> : null}
                </span>
                {choice.label}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.answerType === "property_list") {
    return (
      <PropertyListAnswer value={value} onChange={onChange} disabled={disabled} />
    );
  }

  if (choices.length > 0) {
    return (
      <div className="space-y-3">
        <Label>Your answer</Label>
        {/*
         * Always render choices as a single, top-to-bottom ordered column so the
         * progression of options reads clearly. A multi-column layout (grid /
         * flex-wrap) reorders options across columns and is confusing to follow.
         */}
        <div className="flex flex-col gap-2">
          {choices.map((choice) => (
            <Button
              key={choice.value}
              type="button"
              variant={value === choice.value ? "default" : "outline"}
              disabled={disabled}
              className={OPTION_BUTTON_CLASS}
              onClick={() => onChange(choice.value)}
            >
              {choice.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="intake-text-answer">Your answer</Label>
      <Textarea
        id="intake-text-answer"
        value={value}
        disabled={disabled}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type your answer here..."
      />
    </div>
  );
}

/**
 * Repeatable "add properties" input: up to {@link MAX_PROPERTY_ENTRIES} rows,
 * each an optional label + a ZIP code. Serializes to a JSON array in the stored
 * response value. Local state holds in-progress rows (including a partially
 * typed row that hasn't got a ZIP yet); only ZIP-bearing rows are persisted.
 *
 * Callers should key this by the question id so a fresh question resets state.
 */
function PropertyListAnswer({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<PropertyEntry[]>(() => {
    const parsed = parsePropertyListValue(value);
    return parsed.length ? parsed : [{ zip: "", label: "" }];
  });

  // Re-sync when `value` arrives/changes from outside — e.g. the saved answer
  // loads via the parent's effect after this mounts, or navigation swaps in a
  // different question. The guard (value already equals our serialized rows)
  // prevents clobbering the user's in-progress edits, since our own commit sets
  // value === serialize(rows).
  useEffect(() => {
    setRows((prev) => {
      if (value === serializePropertyListValue(prev)) return prev;
      const parsed = parsePropertyListValue(value);
      return parsed.length ? parsed : [{ zip: "", label: "" }];
    });
  }, [value]);

  const commit = (next: PropertyEntry[]) => {
    setRows(next);
    onChange(serializePropertyListValue(next));
  };

  const updateRow = (index: number, patch: Partial<PropertyEntry>) => {
    commit(rows.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    if (rows.length >= MAX_PROPERTY_ENTRIES) return;
    commit([...rows, { zip: "", label: "" }]);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, idx) => idx !== index);
    commit(next.length ? next : [{ zip: "", label: "" }]);
  };

  return (
    <div className="space-y-3">
      <Label>Properties</Label>
      <p className="text-xs text-muted-foreground">
        Add up to {MAX_PROPERTY_ENTRIES} properties. A ZIP code is required for each.
      </p>
      <div className="space-y-3">
        {rows.map((row, index) => {
          const zipInvalid = row.zip.trim().length > 0 && !isValidZip(row.zip);
          return (
          <div
            key={index}
            className="grid gap-2 rounded-lg border border-border/60 bg-muted/15 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          >
            <div className="space-y-1">
              <Label htmlFor={`property-label-${index}`} className="text-xs">
                Label (optional)
              </Label>
              <Input
                id={`property-label-${index}`}
                value={row.label ?? ""}
                disabled={disabled}
                placeholder={`Property ${index + 1}`}
                onChange={(event) => updateRow(index, { label: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`property-zip-${index}`} className="text-xs">
                ZIP code
              </Label>
              <Input
                id={`property-zip-${index}`}
                value={row.zip}
                disabled={disabled}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="e.g. 90210"
                className="sm:w-32"
                aria-invalid={zipInvalid}
                onChange={(event) => updateRow(index, { zip: event.target.value })}
              />
              {zipInvalid ? (
                <p className="text-xs text-destructive">Enter a 5-digit ZIP (or ZIP+4).</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={disabled || rows.length <= 1}
              aria-label={`Remove property ${index + 1}`}
              onClick={() => removeRow(index)}
            >
              <Minus className="size-4" aria-hidden />
            </Button>
          </div>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={disabled || rows.length >= MAX_PROPERTY_ENTRIES}
        onClick={addRow}
      >
        <Plus className="size-4" aria-hidden />
        Add property
      </Button>
    </div>
  );
}

export function intakeQuestionSupportsAudio(question: IntakeQuestion): boolean {
  return intakeUsesFreeformResponse(question.answerType);
}
