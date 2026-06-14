/** Official AKILI platform logo paths (`public/brand/`). */
export const PLATFORM_LOGO_ASSETS = {
  horizontalCompact: "/brand/akili-horizontal-compact.svg",
  horizontalCompactPng: "/brand/akili-horizontal-compact.png",
  stacked: "/brand/akili-stacked.svg",
  stackedJpg: "/brand/akili-stacked.jpg",
  trademarkOnly: "/brand/akili-trademark-only.svg",
  emailLockup: "/brand/akili-email-lockup.svg",
  emailLockupPng: "/brand/akili-email-lockup.png",
} as const;

/** Logo palette — matches `logo/` SVG sources and email lockup. */
export const PLATFORM_LOGO_COLORS = {
  brandPrimary: "#4EA5D9",
  brandPrimaryDark: "#7DD3FC",
  trustAccent: "#D97706",
  trustAccentDark: "#F59E0B",
} as const;
