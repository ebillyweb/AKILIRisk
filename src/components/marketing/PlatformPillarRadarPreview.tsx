"use client";

import { useId } from "react";
import { maturityScoreToPercent } from "@/lib/assessment/governance-rubric";
import type { SamplePillarScore } from "@/lib/marketing/sample-report-preview";
import { cn } from "@/lib/utils";

type PlatformPillarRadarPreviewProps = {
  pillars: SamplePillarScore[];
  className?: string;
  variant?: "illustrative" | "prominent";
};

const VARIANT_CONFIG = {
  prominent: { size: 280, padding: 48, rScale: 0.34, labelOffset: 22 },
  illustrative: { size: 320, padding: 56, rScale: 0.32, labelOffset: 26 },
} as const;

function axisAngle(index: number, count: number): number {
  return 90 - (360 / count) * index;
}

function labelAnchor(angleDeg: number): {
  textAnchor: "start" | "middle" | "end";
  dx: number;
} {
  const rad = (angleDeg * Math.PI) / 180;
  const x = Math.cos(rad);
  if (x > 0.25) return { textAnchor: "start", dx: 3 };
  if (x < -0.25) return { textAnchor: "end", dx: -3 };
  return { textAnchor: "middle", dx: 0 };
}

export function PlatformPillarRadarPreview({
  pillars,
  className,
  variant = "illustrative",
}: PlatformPillarRadarPreviewProps) {
  const gradientId = useId().replace(/:/g, "");
  const config = VARIANT_CONFIG[variant];
  const { size, rScale, labelOffset } = config;
  const padding = config.padding;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * rScale;
  const count = pillars.length;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const point = (angleDeg: number, value: number) => {
    const rad = toRad(angleDeg);
    const x = cx + r * value * Math.cos(rad);
    const y = cy - r * value * Math.sin(rad);
    return { x, y, coord: `${x},${y}` };
  };

  const axes = pillars.map((pillar, index) => {
    const angle = axisAngle(index, count);
    const inScope = pillar.inScope;
    const percent = inScope ? maturityScoreToPercent(pillar.maturity) : 0;
    const normalized = percent / 100;
    const dataPoint = point(angle, normalized);
    const rad = toRad(angle);
    const x2 = cx + r * Math.cos(rad);
    const y2 = cy - r * Math.sin(rad);
    const labelRadius = r + labelOffset;
    const lx = cx + labelRadius * Math.cos(rad);
    const ly = cy - labelRadius * Math.sin(rad);
    const anchor = labelAnchor(angle);
    return {
      pillar,
      angle,
      inScope,
      percent,
      normalized,
      dataPoint,
      x2,
      y2,
      lx,
      ly,
      anchor,
    };
  });

  const polygonPoints = axes.map(({ dataPoint }) => dataPoint.coord).join(" ");
  const ariaLabel = pillars
    .map((pillar) =>
      pillar.inScope
        ? `${pillar.shortName}: ${maturityScoreToPercent(pillar.maturity)}`
        : `${pillar.shortName}: not in scope`,
    )
    .join("; ");

  return (
    <figure
      className={cn("mx-auto w-full max-w-[22rem] text-brand", className)}
      data-testid="platform-pillar-radar-preview"
    >
      <svg
        viewBox={`${-padding} ${-padding} ${size + padding * 2} ${size + padding * 2}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Platform risk domain radar: ${ariaLabel}`}
      >
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0.06} />
          </radialGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={axes.map(({ angle }) => point(angle, scale).coord).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.18}
            strokeWidth={1}
          />
        ))}

        {[25, 50, 75].map((tick) => (
          <text
            key={tick}
            x={cx + 4}
            y={cy - r * (tick / 100) + 3}
            className="fill-current text-[7px] font-medium opacity-40"
          >
            {tick}
          </text>
        ))}

        {axes.map(({ pillar, x2, y2, inScope }) => (
          <line
            key={`${pillar.slug}-axis`}
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeOpacity={inScope ? 0.32 : 0.16}
            strokeWidth={1}
            strokeDasharray={inScope ? undefined : "3 3"}
          />
        ))}

        <polygon
          points={polygonPoints}
          fill={`url(#${gradientId})`}
          stroke="currentColor"
          strokeOpacity={0.7}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {axes.map(({ pillar, dataPoint, inScope, percent, x2, y2 }) =>
          inScope ? (
            <g key={`${pillar.slug}-point`}>
              <circle
                cx={dataPoint.x}
                cy={dataPoint.y}
                r={5}
                fill="currentColor"
                fillOpacity={0.95}
              />
              <circle
                cx={dataPoint.x}
                cy={dataPoint.y}
                r={8}
                fill="none"
                stroke="currentColor"
                strokeOpacity={pillar.emphasized ? 0.55 : 0.25}
                strokeWidth={pillar.emphasized ? 2 : 1.5}
              />
              <text
                x={dataPoint.x}
                y={dataPoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-current text-[7px] font-bold opacity-90"
              >
                {percent}
              </text>
            </g>
          ) : (
            <g key={`${pillar.slug}-out`}>
              <circle
                cx={x2}
                cy={y2}
                r={4}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.3}
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            </g>
          ),
        )}

        {axes.map(({ pillar, lx, ly, anchor, inScope }) => (
          <text
            key={`${pillar.slug}-label`}
            x={lx + anchor.dx}
            y={ly}
            textAnchor={anchor.textAnchor}
            dominantBaseline="middle"
            className={cn(
              "fill-current text-[8px] font-semibold",
              inScope ? "opacity-80" : "opacity-45",
            )}
          >
            {pillar.shortName}
            {!inScope ? " · N/A" : null}
          </text>
        ))}
      </svg>
    </figure>
  );
}
