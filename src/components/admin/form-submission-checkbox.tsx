"use client";

import { useState, type ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** Checkbox + hidden input so `formData.has(name)` matches native checkbox presence. */
export function FormHasCheckbox({
  name,
  id,
  label,
  defaultChecked = false,
  className,
  submitValue = "1",
  disabled,
}: {
  name: string;
  id: string;
  label: ReactNode;
  defaultChecked?: boolean;
  className?: string;
  /** Value submitted when checked (server may use `has(name)` or compare to `"true"`). */
  submitValue?: string;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className={className}>
      <input type="hidden" name={name} value={submitValue} disabled={!checked} />
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
          disabled={disabled}
          aria-labelledby={`${id}-label`}
        />
        <Label id={`${id}-label`} htmlFor={id} className="cursor-pointer font-normal">
          {label}
        </Label>
      </div>
    </div>
  );
}

/** Checkbox + hidden for `formData.get(name) === "on"` (HTML checkbox default) semantics. */
export function FormOnCheckbox({
  name,
  id,
  label,
  defaultChecked = false,
  disabled,
}: {
  name: string;
  id: string;
  label: ReactNode;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center gap-2 text-sm">
      <input type="hidden" name={name} value={checked ? "on" : ""} />
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => setChecked(v === true)}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
      />
      <Label id={`${id}-label`} htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
    </div>
  );
}
