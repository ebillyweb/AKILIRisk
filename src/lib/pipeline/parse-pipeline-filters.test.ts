import { describe, expect, it } from "vitest";

import {
  buildPipelineHref,
  parsePipelineFiltersFromSearchParams,
} from "./parse-pipeline-filters";

describe("parse-pipeline-filters", () => {
  it("parses assessmentInProgress from search params", () => {
    expect(
      parsePipelineFiltersFromSearchParams({ assessmentInProgress: "1" }),
    ).toMatchObject({
      assessmentInProgress: true,
    });
  });

  it("builds assessmentInProgress href", () => {
    expect(
      buildPipelineHref({ assessmentInProgress: true, sortBy: "lastActivity", sortDir: "desc" }, 1),
    ).toBe("/advisor/pipeline?assessmentInProgress=1");
  });
});
