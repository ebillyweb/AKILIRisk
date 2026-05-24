import type { ClientWorkflowStage } from "@prisma/client";

import type { PipelineFilters } from "./types";

const STAGE_VALUES: ClientWorkflowStage[] = [
  "INVITED",
  "REGISTERED",
  "INTAKE_IN_PROGRESS",
  "INTAKE_COMPLETE",
  "ASSESSMENT_IN_PROGRESS",
  "ASSESSMENT_COMPLETE",
  "DOCUMENTS_REQUIRED",
  "COMPLETE",
];

export function parsePipelineFiltersFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): PipelineFilters {
  const single = (key: string) => {
    const v = searchParams[key];
    return typeof v === "string" ? v : undefined;
  };

  const stageRaw = single("stage");
  const stage = STAGE_VALUES.includes(stageRaw as ClientWorkflowStage)
    ? (stageRaw as ClientWorkflowStage)
    : undefined;

  return {
    stage,
    stalled: single("stalled") === "1" ? true : undefined,
    awaitingIntakeReview: single("awaitingReview") === "1" ? true : undefined,
    documentsNeeded: single("documentsNeeded") === "1" ? true : undefined,
    search: single("search"),
    sortBy: "lastActivity",
    sortDir: "desc",
  };
}
