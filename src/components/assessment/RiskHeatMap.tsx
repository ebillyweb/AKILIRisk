import { cn } from "@/lib/utils";
import {
  ariaLabelForCell,
  buildHeatMapCells,
  formatHeatMapScore,
  rowSeverity,
  type HeatMapCell,
  type PillarScoreInput,
} from "@/lib/assessment/heat-map-data";

/**
 * Round-10 / B1 (BRD §4.3): risk heat map by domain.
 *
 * Two display modes share the same canonical RISK_LEVEL_PALETTE so the
 * single-client view (also used in the PDF report) and the portfolio view
 * (advisor's /admin/intelligence page) stay visually consistent.
 *
 * Color is never the only signal — every cell shows the domain name and
 * the risk-level label as text, plus an aria-label for screen readers.
 * Inline score numbers per the round-10 sign-off.
 */

interface SingleClientProps {
  mode: "single-client";
  pillarScores: ReadonlyArray<PillarScoreInput>;
  /** When set, show only pillars in this scope (Epic 5.11 US-72). */
  includedPillarIds?: readonly string[];
  /** When true and ALL pillars are unassessed, render the "no scored
   *  assessment" banner above the cells. Default true. */
  showUnassessedBanner?: boolean;
  className?: string;
}

interface PortfolioRow {
  clientId: string;
  clientName: string;
  pillarScores: ReadonlyArray<PillarScoreInput>;
}

interface PortfolioProps {
  mode: "portfolio";
  rows: ReadonlyArray<PortfolioRow>;
  className?: string;
}

type RiskHeatMapProps = SingleClientProps | PortfolioProps;

export function RiskHeatMap(props: RiskHeatMapProps) {
  if (props.mode === "single-client") {
    return <SingleClientHeatMap {...props} />;
  }
  return <PortfolioHeatMap {...props} />;
}

// ── Single-client mode ──────────────────────────────────────────────────

const SCORE_BAR_CLASS: Record<HeatMapCell["level"], string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
  unassessed: "bg-muted-foreground/25",
};

function scoreBarPercent(score: number | null): number {
  if (score == null) return 0;
  return Math.min(100, Math.max(0, (score / 3) * 100));
}

function SingleClientHeatMap({
  pillarScores,
  includedPillarIds,
  showUnassessedBanner = true,
  className,
}: SingleClientProps) {
  const cells = buildHeatMapCells(pillarScores, { includedPillarIds });
  const allUnassessed = cells.every((c) => c.level === "unassessed");

  return (
    <div className={cn("space-y-3", className)} data-testid="risk-heat-map-single">
      {allUnassessed && showUnassessedBanner ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          No scored assessment yet. The heat map will populate once an
          assessment is completed.
        </div>
      ) : null}
      <ul className="divide-y divide-border rounded-xl border border-border/80 bg-card/40">
        {cells.map((cell) => (
          <SingleCell key={cell.pillarId} cell={cell} />
        ))}
      </ul>
    </div>
  );
}

function SingleCell({ cell }: { cell: HeatMapCell }) {
  const barWidth = scoreBarPercent(cell.score);

  return (
    <li
      role="img"
      aria-label={ariaLabelForCell(cell)}
      data-risk-level={cell.level}
      data-pillar-id={cell.pillarId}
      className="px-4 py-3 first:rounded-t-xl last:rounded-b-xl"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium leading-snug text-foreground">
              {cell.pillarName}
            </span>
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                cell.palette.bg,
                cell.palette.text,
                cell.palette.border
              )}
            >
              {cell.palette.label}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80"
            aria-hidden
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                SCORE_BAR_CLASS[cell.level]
              )}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>
        <p className="shrink-0 font-mono text-sm tabular-nums text-foreground sm:text-right">
          {formatHeatMapScore(cell.score)}
        </p>
      </div>
    </li>
  );
}

// ── Portfolio mode ──────────────────────────────────────────────────────

function PortfolioHeatMap({ rows, className }: PortfolioProps) {
  // Build cells once per row, then sort by row severity DESC. Most-at-risk
  // client first per round-10 sign-off.
  const enriched = rows.map((row) => {
    const cells = buildHeatMapCells(row.pillarScores);
    return { ...row, cells, sev: rowSeverity(cells) };
  });
  enriched.sort((a, b) => {
    if (a.sev.max !== b.sev.max) return b.sev.max - a.sev.max;
    if (a.sev.avg !== b.sev.avg) return b.sev.avg - a.sev.avg;
    return a.clientName.localeCompare(b.clientName);
  });

  if (enriched.length === 0) {
    return (
      <div
        className={cn("rounded-lg border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground", className)}
        data-testid="risk-heat-map-portfolio-empty"
      >
        No clients yet — invite a client to populate the portfolio heat map.
      </div>
    );
  }

  // Header row: pillar names from the first row's cells (same column order
  // for every row, guaranteed by buildHeatMapCells iterating RISK_AREAS).
  const headerCells = enriched[0]!.cells;

  return (
    <div className={cn("overflow-x-auto", className)} data-testid="risk-heat-map-portfolio">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left">Client</th>
            {headerCells.map((c) => (
              <th key={c.pillarId} className="px-2 py-2 text-center" scope="col">
                {c.pillarName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {enriched.map((row) => (
            <tr key={row.clientId} className="border-b last:border-b-0">
              <th
                scope="row"
                className="px-3 py-2 text-left font-medium align-middle"
              >
                {row.clientName}
              </th>
              {row.cells.map((cell) => (
                <td key={cell.pillarId} className="px-1 py-1 align-middle">
                  <PortfolioCell cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortfolioCell({ cell }: { cell: HeatMapCell }) {
  return (
    <div
      role="img"
      aria-label={ariaLabelForCell(cell)}
      data-risk-level={cell.level}
      data-pillar-id={cell.pillarId}
      title={ariaLabelForCell(cell)}
      className={cn(
        "flex h-9 items-center justify-center rounded-sm border text-xs font-mono tabular-nums",
        cell.palette.bg,
        cell.palette.text,
        cell.palette.border
      )}
    >
      {cell.score == null ? "—" : cell.score.toFixed(1)}
    </div>
  );
}
