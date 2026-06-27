"use client";

import type { ActionPlanItem } from "@/lib/actions/client-action-plan-actions";
import { ActionCard } from "@/components/action-plan/ActionCard";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

type TimeHorizonSectionProps = {
  heading: string;
  subhead?: string;
  items: ActionPlanItem[];
  horizon: "immediate" | "strategic" | "ongoing";
};

export function TimeHorizonSection({
  heading,
  subhead,
  items,
  horizon,
}: TimeHorizonSectionProps) {
  const [openStrategic, setOpenStrategic] = useState(true);

  if (items.length === 0) return null;

  const cardList = (
    <div className="mt-4 space-y-4">
      {items.map((item) => (
        <ActionCard
          key={item.id}
          item={item}
          showCadence={horizon === "ongoing"}
        />
      ))}
    </div>
  );

  // Strategic initiatives use Collapsible per UI-SPEC
  if (horizon === "strategic") {
    return (
      <section>
        <Collapsible open={openStrategic} onOpenChange={setOpenStrategic}>
          <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
            <div>
              <h2 className="text-xl font-semibold font-display tracking-[-0.03em] text-foreground">
                {heading}
              </h2>
              {subhead ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {subhead}
                </p>
              ) : null}
            </div>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                openStrategic ? "rotate-180" : ""
              }`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>{cardList}</CollapsibleContent>
        </Collapsible>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-semibold font-display tracking-[-0.03em] text-foreground">
        {heading}
      </h2>
      {subhead ? (
        <p className="mt-1 text-sm text-muted-foreground">{subhead}</p>
      ) : null}
      {cardList}
    </section>
  );
}
