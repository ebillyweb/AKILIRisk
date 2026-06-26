import type { TourId } from "@/lib/product-tour/types";
import { ADMIN_CONFIGURATION_TOURS } from "@/lib/product-tour/tours/admin-configuration";
import { ADVISOR_CONFIGURATION_TOURS } from "@/lib/product-tour/tours/advisor-configuration";
import { RECOMMENDATION_RULES_TOURS } from "@/lib/product-tour/tours/recommendation-rules";

export const TOUR_STEPS = {
  ...RECOMMENDATION_RULES_TOURS,
  ...ADMIN_CONFIGURATION_TOURS,
  ...ADVISOR_CONFIGURATION_TOURS,
} satisfies Record<TourId, import("@/lib/product-tour/types").TourStepDefinition[]>;
