import { AKILI_BRAND, AKILI_TAGLINES } from "@/lib/brand/tokens";
import { getSeoSiteUrl } from "@/lib/seo/site";

type LlmsLink = {
  title: string;
  path: string;
  description: string;
};

const CORE_PAGES: LlmsLink[] = [
  {
    title: "Home",
    path: "/",
    description:
      "Platform overview for families and professional firms — governance intelligence, sample report output, and pricing preview.",
  },
  {
    title: "For Families",
    path: "/families",
    description: "Family-facing overview of the personal risk profile and structured governance assessment.",
  },
  {
    title: "For Firms",
    path: "/firms",
    description: "Advisor workspace overview for wealth advisors, CPAs, estate attorneys, and family offices.",
  },
  {
    title: "How It Works",
    path: "/how-it-works",
    description: "Assess, analyze, and act — the AKILI engagement workflow across modular risk domains.",
  },
  {
    title: "Docs",
    path: "/docs",
    description:
      "Product documentation for families and firms — quickstarts, intake, assessment, pipeline, branding, and sign-in.",
  },
  {
    title: "About",
    path: "/about",
    description: "Mission, ethos, and who AKILI serves — family wealth governance for professional-led engagements.",
  },
  {
    title: "Pricing",
    path: "/pricing",
    description: "Public module tiers, client limits, and feature comparison for advisor subscriptions.",
  },
  {
    title: "Contact",
    path: "/contact",
    description: "Reach the AKILI team via contact form or email for sales, support, and privacy requests.",
  },
];

const PRODUCT_PAGES: LlmsLink[] = [
  {
    title: "Start assessment",
    path: "/start",
    description: "Client entry point to begin a personal risk profile with an invite code.",
  },
  {
    title: "Request a demo",
    path: "/contact/demo",
    description: "Schedule a walkthrough of the AKILI advisor workspace.",
  },
  {
    title: "Enterprise contact",
    path: "/contact/enterprise",
    description: "Inquire about Enterprise plans for multi-advisor firms.",
  },
  {
    title: "Advisor signup",
    path: "/signup/advisor",
    description: "Self-serve registration for professional firms subscribing to the advisor platform.",
  },
  {
    title: "Client sign in",
    path: "/signin/client",
    description: "Magic-link sign-in for household clients.",
  },
  {
    title: "Advisor sign in",
    path: "/signin/advisor",
    description: "Email and password sign-in for advisor and admin accounts.",
  },
];

const OPTIONAL_PAGES: LlmsLink[] = [
  {
    title: "Privacy policy",
    path: "/privacy",
    description: "How AKILI collects, uses, and protects personal information on the platform.",
  },
  {
    title: "Terms of service",
    path: "/terms",
    description: "Legal terms governing use of the AKILI Risk Intelligence platform.",
  },
];

function formatLink(siteUrl: string, { title, path, description }: LlmsLink): string {
  const url = path === "/" ? siteUrl : `${siteUrl}${path}`;
  return `- [${title}](${url}): ${description}`;
}

function formatSection(siteUrl: string, links: LlmsLink[]): string {
  return links.map((link) => formatLink(siteUrl, link)).join("\n");
}

export function buildLlmsTxt(): string {
  const siteUrl = getSeoSiteUrl();

  return `# ${AKILI_BRAND.legalName}

> ${AKILI_TAGLINES.platform}

AKILI Risk Intelligence is a governance intelligence platform for modern family wealth. Professional firms — wealth advisors, CPAs, estate attorneys, and family offices — use structured assessments to surface succession, authority, and decision-making risks for affluent households. Client-facing intake, scoring, and recommendations live in one shared system of record.

Contact: ${AKILI_BRAND.contact.hello} · ${AKILI_BRAND.websiteUrl}

## Core pages

${formatSection(siteUrl, CORE_PAGES)}

## Product

${formatSection(siteUrl, PRODUCT_PAGES)}

## Optional

${formatSection(siteUrl, OPTIONAL_PAGES)}
`;
}
