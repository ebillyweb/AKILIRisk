import type { DeliverablePhase } from "@prisma/client";

export type ActionPlanDepth = "profile" | "portfolio";

/** PROFILE shows what to address; PORTFOLIO adds facilitated execution detail. */
export function actionPlanDepthForPhase(
  phase: DeliverablePhase,
): ActionPlanDepth {
  return phase === "PORTFOLIO" ? "portfolio" : "profile";
}

export function implementationTypeLabel(
  type: "DIY" | "ADVISORY" | "HYBRID" | null | undefined,
): string | null {
  switch (type) {
    case "DIY":
      return "Self-directed";
    case "ADVISORY":
      return "AKILI-facilitated";
    case "HYBRID":
      return "Guided + advisory completion";
    default:
      return null;
  }
}
