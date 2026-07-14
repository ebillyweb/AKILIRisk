import type { AnalyticsChartTheme } from "@/components/analytics/use-analytics-chart-theme";

/** Maturity scores use a 0–3 platform scale (not 0–10). */
export const MATURITY_SCORE_MAX = 3;

export function maturityScoreColor(
  score: number,
  theme?: Pick<AnalyticsChartTheme, "maturity">,
): string {
  const palette = theme?.maturity;
  if (score >= 2.5) {
    return palette?.excellent ?? "oklch(0.52 0.14 145)";
  }
  if (score >= 1.8) {
    return palette?.good ?? "oklch(0.62 0.12 75)";
  }
  if (score >= 1) {
    return palette?.fair ?? "oklch(0.58 0.14 45)";
  }
  return palette?.poor ?? "oklch(0.55 0.18 28)";
}

const SHORT_CATEGORY_LABELS: Record<string, string> = {
  governance: "Governance",
  "cyber-digital": "Cyber & digital",
  "physical-security": "Physical security",
  insurance: "Insurance",
  "geographic-environmental": "Geographic",
  "reputational-social": "Reputational",
  "liquidity-cash": "Liquidity",
  "tax-exposure": "Tax",
  "estate-succession": "Estate",
  "ai-emerging-tech": "AI Risk",
};

export function shortCategoryLabel(categoryId: string, categoryName: string): string {
  return SHORT_CATEGORY_LABELS[categoryId] ?? categoryName.split(" ")[0] ?? categoryName;
}
