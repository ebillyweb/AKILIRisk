"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer } from "./ChartContainer";
import type { CategoryBreakdownPoint } from "@/lib/analytics/types";
import {
  MATURITY_SCORE_MAX,
  maturityScoreColor,
  shortCategoryLabel,
} from "@/components/analytics/chart-utils";
import {
  tooltipContentStyle,
  useAnalyticsChartTheme,
} from "@/components/analytics/use-analytics-chart-theme";

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownPoint[];
  title?: string;
}

export function CategoryBreakdownChart({
  data,
  title = "Pillar score breakdown",
}: CategoryBreakdownChartProps) {
  const theme = useAnalyticsChartTheme();

  const chartData = data.map((row) => ({
    ...row,
    label: shortCategoryLabel(row.categoryId, row.categoryName),
  }));

  const chartHeight = Math.max(280, chartData.length * 34);

  const chart = (
    <BarChart
      data={chartData}
      layout="vertical"
      margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
      barCategoryGap="18%"
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
        formatter={(value) => [
          typeof value === "number" ? value.toFixed(1) : String(value ?? ""),
          "Score",
        ]}
        labelFormatter={(_, payload) => {
          const row = payload?.[0]?.payload as CategoryBreakdownPoint & {
            label: string;
          };
          return row?.categoryName ?? "";
        }}
        contentStyle={tooltipContentStyle(theme)}
      />
      <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={14}>
        {chartData.map((entry, index) => (
          <Cell
            key={`cell-${index}`}
            fill={maturityScoreColor(entry.score, theme)}
          />
        ))}
      </Bar>
    </BarChart>
  );

  return (
    <ChartContainer title={title} height={chartHeight}>
      {chart}
    </ChartContainer>
  );
}
