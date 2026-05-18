"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Menu, Shield, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminSidebarNav } from "./AdminSidebarNav";

interface AdminMobileNavProps {
  superUser: boolean;
}

export function AdminMobileNav({ superUser }: AdminMobileNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  // Touch gesture handling for swipe-to-open/close
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null); // Reset on new touch
    setTouchStart(e.targetTouches[0]?.clientX ?? null);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]?.clientX ?? null);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    // Close sidebar on left swipe when open
    if (isLeftSwipe && open) {
      close();
    }

    // Open sidebar on right swipe when closed and starting from left edge
    if (isRightSwipe && !open && touchStart < 50) {
      setOpen(true);
    }
  }, [touchStart, touchEnd, open, close]);

  // Debounced toggle to prevent race conditions from rapid clicking
  const toggleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedToggle = useCallback(() => {
    if (toggleTimeoutRef.current) {
      clearTimeout(toggleTimeoutRef.current);
    }
    toggleTimeoutRef.current = setTimeout(() => {
      setOpen(prev => !prev);
    }, 50);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toggleTimeoutRef.current) {
        clearTimeout(toggleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <>
      <div
        className="sticky top-0 z-40 flex items-center gap-3 border-b border-border/60 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 h-11 w-11" // Ensure 44px minimum touch target
          aria-expanded={open}
          aria-controls={panelId}
          onClick={debouncedToggle}
        >
          <Menu className="size-4" />
          <span className="sr-only">
            {open ? "Close navigation menu" : "Open navigation menu"}
          </span>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            AKILI Control
          </p>
          <p className="truncate text-xs text-muted-foreground">Administration</p>
        </div>
        {superUser ? (
          <Badge variant="default" className="shrink-0 text-[10px]">
            Super
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Admin
          </Badge>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-label="Close navigation menu"
            onClick={close}
          />
          <aside
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className={cn(
              "absolute inset-y-0 left-0 flex w-[min(100vw-2rem,20rem)] flex-col",
              "border-r border-border/60 bg-card shadow-xl",
              "animate-in slide-in-from-left duration-200"
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Shield className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">
                    AKILI Control
                  </p>
                  <p className="text-xs text-muted-foreground">Administration</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 h-11 w-11" // Ensure 44px minimum touch target
                onClick={close}
              >
                <X className="size-4" />
                <span className="sr-only">Close navigation menu</span>
              </Button>
            </div>

            <AdminSidebarNav
              superUser={superUser}
              collapsibleSections
              onNavigate={close}
              className="overflow-y-auto"
            />

            <div className="mt-auto border-t border-border/60 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="size-3 shrink-0" />
                <span>Platform Status: Operational</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
