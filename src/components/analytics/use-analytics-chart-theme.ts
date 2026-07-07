"use client";

import { useEffect, useState } from "react";

export type AnalyticsChartTheme = {
  barPrevious: string;
  barCurrent: string;
  trendLine: string;
  grid: string;
  axis: string;
  tooltip: {
    background: string;
    foreground: string;
    border: string;
  };
  maturity: {
    excellent: string;
    good: string;
    fair: string;
    poor: string;
  };
};

function readCssVar(name: string, fallback = ""): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function getAnalyticsChartTheme(): AnalyticsChartTheme {
  return {
    barPrevious: readCssVar("--analytics-bar-previous", readCssVar("--chart-3")),
    barCurrent: readCssVar("--analytics-bar-current", readCssVar("--chart-1")),
    trendLine: readCssVar("--analytics-trend-line", readCssVar("--chart-4")),
    grid: readCssVar("--border"),
    axis: readCssVar("--muted-foreground"),
    tooltip: {
      background: readCssVar("--popover"),
      foreground: readCssVar("--popover-foreground"),
      border: readCssVar("--border"),
    },
    maturity: {
      excellent: readCssVar(
        "--analytics-maturity-excellent",
        readCssVar("--chart-2"),
      ),
      good: readCssVar("--analytics-maturity-good", readCssVar("--chart-4")),
      fair: readCssVar("--analytics-maturity-fair", readCssVar("--chart-5")),
      poor: readCssVar("--analytics-maturity-poor", readCssVar("--destructive")),
    },
  };
}

export function useAnalyticsChartTheme(): AnalyticsChartTheme {
  const [theme, setTheme] = useState<AnalyticsChartTheme>(() =>
    getAnalyticsChartTheme(),
  );

  useEffect(() => {
    const refresh = () => setTheme(getAnalyticsChartTheme());
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", refresh);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", refresh);
    };
  }, []);

  return theme;
}

export function tooltipContentStyle(theme: AnalyticsChartTheme) {
  return {
    borderRadius: 8,
    backgroundColor: theme.tooltip.background,
    color: theme.tooltip.foreground,
    border: `1px solid ${theme.tooltip.border}`,
  };
}
