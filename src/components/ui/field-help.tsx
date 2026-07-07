"use client";

import { CircleHelp } from "lucide-react";
import type { FieldHelpContent, FieldHelpKey } from "@/lib/field-help/content";
import { getFieldHelp } from "@/lib/field-help/content";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type FieldHelpProps = {
  /** Registry key — preferred when help text is shared across screens. */
  helpKey?: FieldHelpKey;
  /** Inline help when no registry key is used. */
  title?: string;
  description?: string;
  className?: string;
  /** Accessible label for the trigger button. */
  triggerLabel?: string;
};

function resolveHelpContent({
  helpKey,
  title,
  description,
}: Pick<FieldHelpProps, "helpKey" | "title" | "description">): FieldHelpContent | null {
  if (helpKey) return getFieldHelp(helpKey);
  if (title && description) return { title, description };
  return null;
}

export function FieldHelp({
  helpKey,
  title,
  description,
  className,
  triggerLabel = "Field help",
}: FieldHelpProps) {
  const content = resolveHelpContent({ helpKey, title, description });
  if (!content) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground",
            className,
          )}
          aria-label={`${triggerLabel}: ${content.title}`}
        >
          <CircleHelp className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start" side="top">
        <PopoverHeader>
          <PopoverTitle>{content.title}</PopoverTitle>
          <PopoverDescription className="text-sm leading-relaxed">
            {content.description}
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

type LabelWithHelpProps = {
  htmlFor?: string;
  helpKey?: FieldHelpKey;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function LabelWithHelp({
  htmlFor,
  helpKey,
  title,
  description,
  children,
  className,
}: LabelWithHelpProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Label htmlFor={htmlFor}>{children}</Label>
      <FieldHelp
        helpKey={helpKey}
        title={title}
        description={description}
        triggerLabel={typeof children === "string" ? children : "Field help"}
      />
    </div>
  );
}
