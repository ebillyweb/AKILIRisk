"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatTriggerSummary } from "@/lib/recommendations/format-trigger";

type Props = {
  mergedEvidence: unknown[];
  assessmentSources: string[];
};

export function EvidenceAccordion({ mergedEvidence, assessmentSources }: Props) {
  if (mergedEvidence.length === 0) {
    return null;
  }

  const sourceCount = new Set(assessmentSources).size;

  return (
    <Accordion type="single" collapsible className="border-none">
      <AccordionItem value="evidence" className="border-none">
        <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:no-underline">
          Evidence from {sourceCount} assessment{sourceCount !== 1 ? "s" : ""}
        </AccordionTrigger>
        <AccordionContent>
          <ul className="space-y-2">
            {mergedEvidence.map((evidence, idx) => (
              <li
                key={idx}
                className="rounded-md border border-border/40 bg-muted/20 px-3 py-2"
              >
                <p className="text-sm text-muted-foreground">
                  {formatTriggerSummary(evidence)}
                </p>
                {assessmentSources.length > 1 && assessmentSources[idx] && (
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Assessment: {assessmentSources[idx]?.slice(0, 8)}...
                  </p>
                )}
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
