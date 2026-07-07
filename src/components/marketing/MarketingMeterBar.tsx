import { cn } from "@/lib/utils";

type MarketingMeterBarProps = {
  percent: number;
  fillClassName: string;
  heightClassName?: string;
  className?: string;
};

/**
 * Horizontal meter without inline CSS width — uses SVG geometry so SEO crawlers
 * do not flag style attributes on marketing pages.
 */
export function MarketingMeterBar({
  percent,
  fillClassName,
  heightClassName = "h-2",
  className,
}: MarketingMeterBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div
      className={cn("overflow-hidden rounded-full bg-secondary/90", heightClassName, className)}
      role="presentation"
    >
      <svg
        viewBox="0 0 100 1"
        preserveAspectRatio="none"
        className="block h-full w-full"
        aria-hidden
      >
        <rect x={0} y={0} width={clamped} height={1} rx={0.5} className={fillClassName} />
      </svg>
    </div>
  );
}
