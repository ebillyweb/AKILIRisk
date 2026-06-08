import { describe, expect, it } from "vitest";
import {
  actionPlanDepthForPhase,
  implementationTypeLabel,
  isDeliverableProfilePublished,
} from "@/lib/assessment/plan-depth";

describe("actionPlanDepthForPhase", () => {
  it("uses profile depth for PREVIEW and PROFILE", () => {
    expect(actionPlanDepthForPhase("PREVIEW")).toBe("profile");
    expect(actionPlanDepthForPhase("PROFILE")).toBe("profile");
  });

  it("uses portfolio depth for PORTFOLIO", () => {
    expect(actionPlanDepthForPhase("PORTFOLIO")).toBe("portfolio");
  });
});

describe("isDeliverableProfilePublished", () => {
  it("is false in PREVIEW and true after profile publish", () => {
    expect(isDeliverableProfilePublished("PREVIEW")).toBe(false);
    expect(isDeliverableProfilePublished("PROFILE")).toBe(true);
    expect(isDeliverableProfilePublished("PORTFOLIO")).toBe(true);
  });
});

describe("implementationTypeLabel", () => {
  it("maps implementation types for client copy", () => {
    expect(implementationTypeLabel("ADVISORY")).toBe("AKILI-facilitated");
    expect(implementationTypeLabel("DIY")).toBe("Self-directed");
    expect(implementationTypeLabel(null)).toBeNull();
  });
});
