"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ResponsiveContainer } from "recharts";
import type { CategoryBreakdownPoint } from "@/lib/analytics/types";
import {
  MATURITY_SCORE_MAX,
  shortCategoryLabel,
} from "@/components/analytics/chart-utils";
import {
  tooltipContentStyle,
  useAnalyticsChartTheme,
} from "@/components/analytics/use-analytics-chart-theme";

export type PillarComparisonRow = {
  categoryId: string;
  label: string;
  previous: number | null;
  current: number;
  delta: number;
};

export function buildPillarComparisonRows(
  previousCategories: CategoryBreakdownPoint[],
  currentCategories: CategoryBreakdownPoint[],
): PillarComparisonRow[] {
  const previousById = new Map(
    previousCategories.map((row) => [row.categoryId, row.score]),
  );
  const order = new Map<string, string>();
  for (const row of previousCategories) {
    order.set(row.categoryId, row.categoryName);
  }
  for (const row of currentCategories) {
    order.set(row.categoryId, row.categoryName);
  }

  return [...order.entries()].map(([categoryId, categoryName]) => {
    const previous = previousById.get(categoryId) ?? null;
    const current =
      currentCategories.find((row) => row.categoryId === categoryId)?.score ?? 0;
    return {
      categoryId,
      label: shortCategoryLabel(categoryId, categoryName),
      previous,
      current,
      delta: previous == null ? 0 : current - previous,
    };
  });
}

interface PillarComparisonChartProps {
  rows: PillarComparisonRow[];
}

export function PillarComparisonChart({ rows }: PillarComparisonChartProps) {
  const theme = useAnalyticsChartTheme();

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No pillar scores to compare.
      </p>
    );
  }

  const chartHeight = Math.max(320, rows.length * 40);

  return (
    <div className="rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            horizontal={false}
            strokeDasharray="3 3"
            stroke={theme.grid}
            strokeOpacity={0.45}
          />
          <XAxis
            type="number"
            domain={[0, MATURITY_SCORE_MAX]}
            ticks={[0, 1, 2, 3]}
            tick={{ fontSize: 12, fill: theme.axis }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={112}
            tick={{ fontSize: 12, fill: theme.axis }}
          />
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" ? value.toFixed(1) : String(value ?? ""),
              name === "previous" ? "Previous" : "Latest",
            ]}
            labelFormatter={(label) => String(label)}
            contentStyle={tooltipContentStyle(theme)}
          />
          <Legend
            verticalAlign="top"
            height={28}
            formatter={(value) => (value === "previous" ? "Previous" : "Latest")}
          />
          <Bar
            dataKey="previous"
            name="previous"
            fill={theme.barPrevious}
            fillOpacity={0.85}
            radius={[0, 4, 4, 0]}
            barSize={10}
          />
          <Bar
            dataKey="current"
            name="current"
            fill={theme.barCurrent}
            radius={[0, 4, 4, 0]}
            barSize={10}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-muted-foreground">
        Pillar scores use the 0–3 maturity scale (higher is better).
      </p>
    </div>
  );
}
