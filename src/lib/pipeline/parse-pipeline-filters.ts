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
    needsRescore: single("needsRescore") === "1" ? true : undefined,
    inactive: single("inactive") === "1" ? true : undefined,
    search: single("search"),
    sortBy: "lastActivity",
    sortDir: "desc",
  };
}

export function parsePipelinePageFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): number {
  const raw = searchParams.page;
  const value = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function buildPipelineHref(
  filters: PipelineFilters,
  page: number,
): string {
  const sp = new URLSearchParams();
  if (filters.stage) sp.set("stage", filters.stage);
  if (filters.stalled) sp.set("stalled", "1");
  if (filters.awaitingIntakeReview) sp.set("awaitingReview", "1");
  if (filters.documentsNeeded) sp.set("documentsNeeded", "1");
  if (filters.needsRescore) sp.set("needsRescore", "1");
  if (filters.inactive) sp.set("inactive", "1");
  if (filters.search?.trim()) sp.set("search", filters.search.trim());
  if (page > 1) sp.set("page", String(page));
  const query = sp.toString();
  return `/advisor/pipeline${query ? `?${query}` : ""}`;
}
