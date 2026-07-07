"use client";

import type { TourId } from "@/lib/product-tour/types";
import { ProductTourButton } from "@/components/product-tour/ProductTourButton";

type AdminRecommendationsTourButtonProps = {
  view: "services" | "rules";
};

export function AdminRecommendationsTourButton({ view }: AdminRecommendationsTourButtonProps) {
  const tourId: TourId =
    view === "rules" ? "admin-recommendation-rules-list" : "admin-recommendation-catalog";
  return <ProductTourButton tourId={tourId} autoStart />;
}
