/**
 * Static SVG radar chart for marketing previews.
 * Axes align to the five governance dimensions shown in sample reports.
 */

const DEFAULT_AXES = [
  { label: "Succession", angle: 90 },
  { label: "Authority", angle: 90 - 72 },
  { label: "Communication", angle: 90 - 144 },
  { label: "Structure", angle: 90 - 216 },
  { label: "Continuity", angle: 90 - 288 },
] as const;

type GovernanceRadarPreviewProps = {
  className?: string;
  /** Normalized 0–1 values per axis (Succession → Continuity) */
  values?: number[];
  variant?: "subtle" | "prominent" | "illustrative";
};

const VARIANT_CONFIG = {
  subtle: { size: 160, padding: 28, rScale: 0.34, labelOffset: 18 },
  prominent: { size: 220, padding: 32, rScale: 0.34, labelOffset: 22 },
  illustrative: { size: 300, padding: 44, rScale: 0.36, labelOffset: 28 },
} as const;

export function GovernanceRadarPreview({
  className,
  values = [0.53, 0.67, 0.72, 0.77, 0.63],
  variant = "subtle",
}: GovernanceRadarPreviewProps) {
  const config = VARIANT_CONFIG[variant];
  const { size, rScale, labelOffset } = config;
  const padding = variant === "subtle" ? 28 : config.padding;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * rScale;
  const illustrative = variant === "illustrative";
  const prominent = variant === "prominent" || illustrative;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const point = (angleDeg: number, value: number) => {
    const rad = toRad(angleDeg);
    const x = cx + r * value * Math.cos(rad);
    const y = cy - r * value * Math.sin(rad);
    return { x, y, coord: `${x},${y}` };
  };

  const dataPoints = DEFAULT_AXES.map((axis, index) =>
    point(axis.angle, values[index] ?? 0),
  );
  const polygonPoints = dataPoints.map((p) => p.coord).join(" ");

  const axisPoints = DEFAULT_AXES.map((axis, index) => {
    const rad = toRad(axis.angle);
    const x2 = cx + r * Math.cos(rad);
    const y2 = cy - r * Math.sin(rad);
    const labelRadius = r + labelOffset;
    const lx = cx + labelRadius * Math.cos(rad);
    const ly = cy - labelRadius * Math.sin(rad);
    const value = values[index] ?? 0;
    const valueRadius = r * value + (illustrative ? 14 : 0);
    const vx = cx + valueRadius * Math.cos(rad);
    const vy = cy - valueRadius * Math.sin(rad);
    return {
      x1: cx,
      y1: cy,
      x2,
      y2,
      label: axis.label,
      lx,
      ly,
      valuePercent: Math.round(value * 100),
      vx,
      vy,
    };
  });

  return (
    <figure className={className} aria-hidden>
      <svg
        viewBox={`${-padding} ${-padding} ${size + padding * 2} ${size + padding * 2}`}
        className="h-full w-full"
        role="img"
        aria-label="Governance pillar radar: Succession, Authority, Communication, Structure, Continuity"
      >
        <defs>
          <radialGradient id="radar-fill-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity={illustrative ? 0.28 : 0.12} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={illustrative ? 0.06 : 0.04} />
          </radialGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={DEFAULT_AXES.map((axis) => point(axis.angle, scale).coord).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={illustrative ? 0.18 : prominent ? 0.16 : 0.12}
            strokeWidth={illustrative ? 1 : prominent ? 0.8 : 0.6}
          />
        ))}

        {illustrative
          ? [25, 50, 75].map((tick) => (
              <text
                key={tick}
                x={cx + 4}
                y={cy - r * (tick / 100) + 3}
                className="fill-current text-[7px] font-medium opacity-40"
              >
                {tick}
              </text>
            ))
          : null}

        {axisPoints.map(({ x1, y1, x2, y2 }) => (
          <line
            key={`${x2}-${y2}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeOpacity={illustrative ? 0.32 : prominent ? 0.28 : 0.2}
            strokeWidth={illustrative ? 1 : prominent ? 0.8 : 0.6}
          />
        ))}

        <polygon
          points={polygonPoints}
          fill={illustrative ? "url(#radar-fill-gradient)" : "currentColor"}
          fillOpacity={illustrative ? 1 : prominent ? 0.16 : 0.08}
          stroke="currentColor"
          strokeOpacity={illustrative ? 0.7 : prominent ? 0.55 : 0.35}
          strokeWidth={illustrative ? 2 : prominent ? 1.5 : 1}
          strokeLinejoin="round"
        />

        {prominent
          ? dataPoints.map((p, index) => (
              <g key={DEFAULT_AXES[index].label}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={illustrative ? 5 : 3.5}
                  fill="currentColor"
                  fillOpacity={0.95}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={illustrative ? 8 : 5}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.25}
                  strokeWidth={1.5}
                />
              </g>
            ))
          : null}

        {illustrative
          ? axisPoints.map(({ label, vx, vy, valuePercent }) => (
              <text
                key={`${label}-value`}
                x={vx}
                y={vy}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-current text-[8px] font-bold opacity-90"
              >
                {valuePercent}
              </text>
            ))
          : null}

        {axisPoints.map(({ label, lx, ly }) => (
          <text
            key={label}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className={
              illustrative
                ? "fill-current text-[10px] font-semibold opacity-80"
                : prominent
                  ? "fill-current text-[9px] font-semibold opacity-70"
                  : "fill-current text-[8px] font-medium opacity-50"
            }
          >
            {label}
          </text>
        ))}
      </svg>
    </figure>
  );
}
