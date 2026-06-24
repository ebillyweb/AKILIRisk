"use client";

import { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AuthPanelProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function AuthPanel({
  eyebrow,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
}: AuthPanelProps) {
  return (
    <Card
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-[1.25rem] border-border/70 bg-card/80 shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset]",
        className
      )}
    >
      <CardHeader className="space-y-4 border-b section-divider pb-6">
        {eyebrow ? <p className="editorial-kicker">{eyebrow}</p> : null}
        <div className="min-w-0 space-y-2">
          <CardTitle className="max-w-full text-2xl font-semibold break-words text-pretty sm:text-3xl">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="max-w-xl break-words text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </CardDescription>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={cn("pt-8", contentClassName)}>{children}</CardContent>
      {footer ? (
        <CardFooter className="border-t section-divider pt-6 text-sm text-muted-foreground">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
