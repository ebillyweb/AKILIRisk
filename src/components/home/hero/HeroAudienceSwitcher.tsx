"use client";

import { useCallback, useRef } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  HERO_AUDIENCE_OPTIONS,
  type HeroAudience,
} from "@/components/home/hero/hero-audience-content";

type HeroAudienceSwitcherProps = {
  value: HeroAudience;
  onChange: (value: HeroAudience) => void;
  idPrefix: string;
  className?: string;
};

export function HeroAudienceSwitcher({
  value,
  onChange,
  idPrefix,
  className,
}: HeroAudienceSwitcherProps) {
  const tabRefs = useRef<Partial<Record<HeroAudience, HTMLButtonElement>>>({});

  const focusTab = useCallback((audience: HeroAudience) => {
    tabRefs.current[audience]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const lastIndex = HERO_AUDIENCE_OPTIONS.length - 1;
      let nextIndex: number | null = null;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = index === lastIndex ? 0 : index + 1;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = index === 0 ? lastIndex : index - 1;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = lastIndex;
          break;
        default:
          return;
      }

      event.preventDefault();
      const next = HERO_AUDIENCE_OPTIONS[nextIndex];
      onChange(next.id);
      focusTab(next.id);
    },
    [focusTab, onChange]
  );

  return (
    <LayoutGroup id={`${idPrefix}-layout`}>
      <div
        role="tablist"
        aria-label="Choose your path"
        className={cn(
          "relative inline-flex w-full max-w-md rounded-full border border-border/70 bg-muted/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-sm sm:w-auto",
          className
        )}
      >
        {HERO_AUDIENCE_OPTIONS.map((option, index) => {
          const isActive = value === option.id;
          const tabId = `${idPrefix}-tab-${option.id}`;
          const panelId = `${idPrefix}-panel-${option.id}`;

          return (
            <button
              key={option.id}
              ref={(node) => {
                tabRefs.current[option.id] = node ?? undefined;
              }}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "relative z-10 flex min-h-11 flex-1 items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium tracking-tight transition-colors duration-200 sm:min-w-[9.5rem] sm:px-6",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/90"
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId={`${idPrefix}-hero-audience-pill`}
                  className="absolute inset-0 rounded-full border border-border/60 bg-card shadow-[0_4px_20px_-8px_rgba(26,24,20,0.2)]"
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                  }}
                />
              ) : null}
              <span className="relative z-10">{option.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
