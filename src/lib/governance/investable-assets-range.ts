import type { InvestableAssetsRange } from "@prisma/client";

export const INVESTABLE_ASSETS_RANGE_OPTIONS: {
  value: InvestableAssetsRange;
  label: string;
}[] = [
  { value: "UNDER_5M", label: "Under $5M" },
  { value: "FROM_5M_TO_25M", label: "$5M – $25M" },
  { value: "FROM_25M_TO_100M", label: "$25M – $100M" },
  { value: "OVER_100M", label: "$100M+" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

export function formatInvestableAssetsRange(value: InvestableAssetsRange): string {
  return (
    INVESTABLE_ASSETS_RANGE_OPTIONS.find((option) => option.value === value)?.label ??
    value.replace(/_/g, " ").toLowerCase()
  );
}
