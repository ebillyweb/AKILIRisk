import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Explicit pixel height — sets SVG width/height attrs for reliable Safari/Chrome sizing. */
  height?: number;
};

const LOCKUP_ASPECT = 280 / 80;
const HEADER_LOCKUP_ASPECT = 268 / 40;

const LOGO_FONT =
  "IBM Plex Sans, var(--font-manrope), -apple-system, system-ui, sans-serif";

function RadarMark({
  fillId,
  centerX,
  centerY,
  scale = 1,
}: {
  fillId: string;
  centerX: number;
  centerY: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${centerX},${centerY}) scale(${scale})`}>
      <polygon
        points="0,-22 20,-7 13,19 -13,19 -20,-7"
        fill="none"
        stroke="var(--logo-brand-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <polygon
        points="0,-14 12.5,-4.5 8,12 -8,12 -12.5,-4.5"
        fill="none"
        stroke="var(--logo-brand-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <polygon
        points="0,-8 7,-2.5 4.5,6.5 -4.5,6.5 -7,-2.5"
        fill="none"
        stroke="var(--logo-brand-primary)"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <line x1="0" y1="0" x2="0" y2="-22" stroke="var(--logo-brand-primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="0" y1="0" x2="20" y2="-7" stroke="var(--logo-brand-primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="0" y1="0" x2="13" y2="19" stroke="var(--logo-brand-primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="0" y1="0" x2="-13" y2="19" stroke="var(--logo-brand-primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="0" y1="0" x2="-20" y2="-7" stroke="var(--logo-brand-primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <polygon
        points="0,-18 16,-4 9,14 -6,10 -14,-4"
        fill={`url(#${fillId})`}
        stroke="var(--logo-trust-accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="0" cy="-18" r="2.5" fill="var(--logo-trust-accent)" />
      <circle cx="16" cy="-4" r="2.5" fill="var(--logo-trust-accent)" />
      <circle cx="9" cy="14" r="2.5" fill="var(--logo-trust-accent)" />
      <circle cx="-6" cy="10" r="2.5" fill="var(--logo-trust-accent)" />
      <circle cx="-14" cy="-4" r="2.5" fill="var(--logo-trust-accent)" />
      <circle cx="0" cy="0" r="3" fill="var(--logo-brand-primary)" />
    </g>
  );
}

function RadarMarkGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="var(--logo-trust-accent)" stopOpacity="0.15" />
      <stop offset="100%" stopColor="var(--logo-brand-primary)" stopOpacity="0.08" />
    </linearGradient>
  );
}

/**
 * Compact header lockup: radar mark + "AKILI" and "Risk Intelligence" on one line.
 * Shorter height fits nav bars while keeping tagline readable at header scale.
 */
export function AkiliHeaderLockup({ className, height = 40 }: LogoProps) {
  const width = Math.round(height * HEADER_LOCKUP_ASPECT);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 268 40"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className={cn("akili-header-lockup block shrink-0", className)}
      role="img"
      aria-label="AKILI Risk Intelligence"
    >
      <defs>
        <RadarMarkGradient id="akiliHeaderLockupDataFill" />
      </defs>

      <RadarMark
        fillId="akiliHeaderLockupDataFill"
        centerX={20}
        centerY={20}
        scale={0.82}
      />

      <text
        x="44"
        y="26"
        fontFamily={LOGO_FONT}
        fontSize="18"
        fontWeight="800"
        fill="var(--logo-foreground)"
        letterSpacing="0.5"
      >
        AKILI
        <tspan
          fontSize="7"
          fontWeight="600"
          fill="var(--logo-trust-accent)"
          baselineShift="super"
          dx="1"
        >
          ®
        </tspan>
      </text>

      <line
        x1="108"
        y1="12"
        x2="108"
        y2="30"
        stroke="var(--logo-border)"
        strokeWidth="0.75"
        opacity="0.85"
      />

      <text
        x="116"
        y="26"
        fontFamily={LOGO_FONT}
        fontSize="14.5"
        fontWeight="600"
        fill="var(--logo-muted-foreground)"
        letterSpacing="0.15"
      >
        Risk Intelligence
      </text>
    </svg>
  );
}

/**
 * AKILI logo lockup: radar symbol + wordmark + tagline (stacked).
 * Uses official brand palette from `logo/` (`--logo-brand-primary`, not editorial `--brand`).
 */
export function AkiliLogoLockup({ className, height = 48 }: LogoProps) {
  const width = Math.round(height * LOCKUP_ASPECT);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 280 80"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className={cn("akili-logo-lockup block shrink-0", className)}
      role="img"
      aria-label="AKILI Risk Intelligence"
    >
      <defs>
        <RadarMarkGradient id="akiliLockupDataFill" />
      </defs>

      <RadarMark fillId="akiliLockupDataFill" centerX={30} centerY={40} />

      <text
        x="58"
        y="36"
        textAnchor="start"
        fontFamily={LOGO_FONT}
        fontSize="28"
        fontWeight="800"
        fill="var(--logo-foreground)"
        letterSpacing="0.8"
      >
        AKILI
        <tspan
          fontSize="8"
          fontWeight="600"
          fill="var(--logo-trust-accent)"
          baselineShift="super"
          dx="1"
        >
          ®
        </tspan>
      </text>

      <line x1="58" y1="44" x2="180" y2="44" stroke="var(--logo-border)" strokeWidth="0.5" />

      <text
        x="58"
        y="56"
        textAnchor="start"
        fontFamily={LOGO_FONT}
        fontSize="13"
        fontWeight="600"
        fill="var(--logo-muted-foreground)"
        letterSpacing="0.4"
      >
        Risk Intelligence
      </text>
    </svg>
  );
}

/** Icon-only radar mark for favicons and compact UI. */
export function AkiliIcon({ className, size = 32 }: LogoProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("akili-logo-lockup", className)}
      role="img"
      aria-label="AKILI"
    >
      <defs>
        <linearGradient id="akiliIconDataFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-brand-primary)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--logo-brand-primary)" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      <g transform="translate(30,30)">
        <polygon
          points="0,-18 16,-5.5 10,15 -10,15 -16,-5.5"
          fill="none"
          stroke="var(--logo-brand-primary)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <polygon
          points="0,-9 8,-2.75 5,7.5 -5,7.5 -8,-2.75"
          fill="none"
          stroke="var(--logo-brand-primary)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.6"
        />
        <polygon
          points="0,-12 10,-2 6,8 -4,5 -8,-2"
          fill="url(#akiliIconDataFill)"
          stroke="var(--logo-trust-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="0" cy="0" r="3" fill="var(--logo-brand-primary)" />
      </g>
    </svg>
  );
}

/** Horizontal compact lockup (wordmark only, no tagline). */
export function AkiliHorizontal({ className }: LogoProps) {
  return (
    <svg
      width="240"
      height="80"
      viewBox="0 0 240 80"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("akili-logo-lockup", className)}
      role="img"
      aria-label="AKILI"
    >
      <defs>
        <linearGradient id="akiliHorizontalDataFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-trust-accent)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--logo-brand-primary)" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      <g transform="translate(40,40)">
        <polygon
          points="0,-22 20,-7 13,19 -13,19 -20,-7"
          fill="none"
          stroke="var(--logo-brand-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          opacity="0.8"
        />
        <polygon
          points="0,-14 12.5,-4.5 8,12 -8,12 -12.5,-4.5"
          fill="none"
          stroke="var(--logo-brand-primary)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.6"
        />
        <polygon
          points="0,-8 7,-2.5 4.5,6.5 -4.5,6.5 -7,-2.5"
          fill="none"
          stroke="var(--logo-brand-primary)"
          strokeWidth="1.2"
          strokeLinejoin="round"
          opacity="0.4"
        />
        <line x1="0" y1="0" x2="0" y2="-22" stroke="var(--logo-brand-primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="0" y1="0" x2="20" y2="-7" stroke="var(--logo-brand-primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="0" y1="0" x2="13" y2="19" stroke="var(--logo-brand-primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="0" y1="0" x2="-13" y2="19" stroke="var(--logo-brand-primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="0" y1="0" x2="-20" y2="-7" stroke="var(--logo-brand-primary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <polygon
          points="0,-18 16,-4 9,14 -6,10 -14,-4"
          fill="url(#akiliHorizontalDataFill)"
          stroke="var(--logo-trust-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="0" cy="-18" r="2.5" fill="var(--logo-trust-accent)" />
        <circle cx="16" cy="-4" r="2.5" fill="var(--logo-trust-accent)" />
        <circle cx="9" cy="14" r="2.5" fill="var(--logo-trust-accent)" />
        <circle cx="-6" cy="10" r="2.5" fill="var(--logo-trust-accent)" />
        <circle cx="-14" cy="-4" r="2.5" fill="var(--logo-trust-accent)" />
        <circle cx="0" cy="0" r="3" fill="var(--logo-brand-primary)" />
      </g>

      <text
        x="75"
        y="50"
        textAnchor="start"
        fontFamily="IBM Plex Sans, var(--font-manrope), -apple-system, system-ui, sans-serif"
        fontSize="36"
        fontWeight="800"
        fill="var(--logo-foreground)"
        letterSpacing="1"
      >
        AKILI
      </text>
      <text
        x="218"
        y="19"
        textAnchor="start"
        fontFamily="IBM Plex Sans, var(--font-manrope), -apple-system, system-ui, sans-serif"
        fontSize="10"
        fontWeight="600"
        fill="var(--logo-trust-accent)"
      >
        ®
      </text>
    </svg>
  );
}
