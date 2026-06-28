"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { formatChartDate } from '@/lib/analytics/formatters';
import type { GovernanceTrendPoint } from '@/lib/analytics/types';
import {
  tooltipContentStyle,
  useAnalyticsChartTheme,
} from '@/components/analytics/use-analytics-chart-theme';

interface GovernanceTrendChartProps {
  data: GovernanceTrendPoint[];
}

export function GovernanceTrendChart({ data }: GovernanceTrendChartProps) {
  const theme = useAnalyticsChartTheme();

  if (data.length < 2) {
    return (
      <ChartContainer title="Governance Score Trend">
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Complete more assessments to see trends
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer title="Governance Score Trend">
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        aria-label="Governance score trend over time"
      >
        <XAxis
          dataKey="date"
          tickFormatter={formatChartDate}
          tick={{ fill: theme.axis }}
        />
        <YAxis
          domain={[0, 3]}
          ticks={[0, 1, 2, 3]}
          tick={{ fill: theme.axis }}
          label={{ value: 'Score (0–3)', angle: -90, position: 'insideLeft', fill: theme.axis }}
        />
        <Tooltip
          formatter={(value: any) => [typeof value === 'number' ? value.toFixed(1) : value, 'Score']}
          labelFormatter={(label: any) => typeof label === 'string' ? formatChartDate(label) : label}
          contentStyle={tooltipContentStyle(theme)}
        />
        <Line
          type="monotone"
          dataKey="overallScore"
          stroke={theme.trendLine}
          strokeWidth={2}
          dot={{ fill: theme.trendLine, strokeWidth: 2, r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}