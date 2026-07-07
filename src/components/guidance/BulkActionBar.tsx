"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DeferDialog } from "@/components/guidance/DeferDialog";
import { includeInActionPlan, bulkDefer } from "@/lib/actions/guidance-actions";

type Props = {
  selectedIds: string[];
  onClearSelection: () => void;
  clientId: string;
};

export function BulkActionBar({
  selectedIds,
  onClearSelection,
  clientId: _clientId,
}: Props) {
  const [deferOpen, setDeferOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleIncludeAll() {
    startTransition(async () => {
      await includeInActionPlan({ recommendationIds: selectedIds });
      onClearSelection();
    });
  }

  async function handleBulkDefer(data: {
    reason: string;
    revisitDate?: string;
    triggerEvent?: string;
    notes?: string;
  }) {
    await bulkDefer({
      recommendationIds: selectedIds,
      reason: data.reason,
      revisitDate: data.revisitDate,
    });
    onClearSelection();
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleIncludeAll}
              disabled={isPending}
            >
              {isPending ? "Including..." : "Include All"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeferOpen(true)}
              disabled={isPending}
            >
              Defer All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isPending}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      <DeferDialog
        open={deferOpen}
        onOpenChange={setDeferOpen}
        onDefer={handleBulkDefer}
        bulkCount={selectedIds.length}
      />
    </>
  );
}
