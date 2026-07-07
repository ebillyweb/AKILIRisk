"use client";

import { useQuery } from "@tanstack/react-query";
import type { PillarCatalogEntry } from "@/lib/methodology/pillar-catalog";

export function usePlatformPillarCatalog() {
  return useQuery<PillarCatalogEntry[]>({
    queryKey: ["platform-pillar-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/platform/risk-domains");
      if (!res.ok) throw new Error("Failed to load platform risk domains");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
