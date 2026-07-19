"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { cn } from "@/lib/utils";

export function DocsMobileNav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const prefersReducedMotion = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 text-sm font-medium text-foreground",
          "transition-colors duration-200 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        )}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>Documentation menu</span>
        <span className="text-muted-foreground" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0 }}
            transition={transition}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl border border-border/60 bg-card/50 p-4">
              <DocsSidebar onNavigate={() => setOpen(false)} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
