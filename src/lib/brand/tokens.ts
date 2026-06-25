/**
 * Canonical AKILI platform brand tokens.
 * Source of truth for marketing, email, decks, and documentation.
 * Advisor white-label overrides these at runtime — see `AdvisorBrandingData`.
 */

export const AKILI_BRAND = {
  legalName: "AKILI Risk Intelligence",
  shortName: "AKILI",
  website: "akilirisk.com",
  websiteUrl: "https://akilirisk.com",
  contact: {
    hello: "hello@akilirisk.com",
    sales: "sales@akilirisk.com",
    privacy: "privacy@akilirisk.com",
  },
} as const;

/** Official logo lockup palette — radar icon, not editorial UI `--brand`. */
export const AKILI_LOGO_COLORS = {
  brandPrimary: { light: "#4EA5D9", dark: "#7DD3FC" },
  trustAccent: { light: "#D97706", dark: "#F59E0B" },
  foreground: { light: "#1e293b", dark: "#f1f5f9" },
  muted: { light: "#64748b", dark: "#94a3b8" },
  border: { light: "#e2e8f0", dark: "#334155" },
} as const;

/** App UI, PDF defaults, and deck backgrounds. */
export const AKILI_UI_COLORS = {
  navy: "#1E293B",
  navyDeep: "#1A1A2E",
  slateDeep: "#0F172A",
  offWhite: "#F8FAFC",
  white: "#FFFFFF",
  pdfPrimary: "#1a1a2e",
  pdfSecondary: "#16213e",
  pdfAccent: "#10b981",
  ctaBackground: "#18181b",
} as const;

/** Pitch deck / PowerPoint (hex without `#` for pptxgenjs). */
export const AKILI_DECK_COLORS = {
  navy: "1E293B",
  navyDeep: "1A1A2E",
  brandBlue: "4EA5D9",
  trustAccent: "D97706",
  white: "FFFFFF",
  offWhite: "F8FAFC",
  muted: "64748B",
  lightBorder: "E2E8F0",
  success: "10B981",
} as const;

export const AKILI_TAGLINES = {
  /** Primary investor / homepage headline */
  platform: "The governance intelligence platform for modern family wealth.",
  /** Product / client-facing */
  product: "Prevent family wealth from becoming family conflict.",
  /** Transactional email header */
  email: "Intelligent governance for advisory teams",
  /** Category positioning */
  category: "Governance Intelligence Platform",
} as const;

export const AKILI_MESSAGING = {
  mission:
    "Legacy survives through governance, not assumption.",
  productDescriptor: "Personal Risk Profile",
  scoreName: "Family Governance Score",
  moatPhrase: "The system of record for family governance.",
  confidencePhrase: "We sell confidence, not questionnaires.",
} as const;

export const AKILI_TYPOGRAPHY = {
  logo: "IBM Plex Sans",
  uiSans: "Manrope",
  uiDisplay: "Cormorant Garamond",
  uiMono: "Geist Mono",
  deckTitle: "Calibri Light",
  deckBody: "Calibri",
} as const;

/** Repo-relative paths from project root. */
export const AKILI_LOGO_ASSETS = {
  stackedSvg: "logo/akili-stacked.svg",
  stackedWebJpg: "logo/akili-stacked-web.jpg",
  horizontalSvg: "logo/akili-horizontal-compact.svg",
  horizontalPng: "logo/akili-horizontal-compact.png",
  trademarkSvg: "logo/akili-trademark-only.svg",
  emailLockupPng: "public/brand/akili-email-lockup.png",
  emailLockupSvg: "public/brand/akili-email-lockup.svg",
  previewHtml: "logo/logo-export-preview.html",
} as const;

export const AKILI_EMAIL = {
  headerGradient:
    "linear-gradient(145deg,#1e293b 0%,#0f172a 55%,#172554 100%)",
  logoPublicPath: "/brand/akili-email-lockup.png",
} as const;
