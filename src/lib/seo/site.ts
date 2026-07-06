import type { Metadata } from "next";

import { AKILI_BRAND, AKILI_TAGLINES } from "@/lib/brand/tokens";
import { getPublicAppUrlFromEnv } from "@/lib/public-app-url";

export type PublicSitemapEntry = {
  path: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
};

/** Public marketing routes included in sitemap.xml and allowed in robots.txt. */
export const PUBLIC_SITEMAP_ENTRIES: PublicSitemapEntry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/signup/advisor", changeFrequency: "monthly", priority: 0.7 },
];

/** Paths that should not be indexed or crawled beyond marketing pages. */
export const ROBOTS_DISALLOW_PATHS = [
  "/admin/",
  "/advisor/",
  "/api/",
  "/assessment/",
  "/branded/",
  "/consent/",
  "/dashboard/",
  "/documents/",
  "/family/",
  "/intake/",
  "/profiles/",
  "/settings/",
] as const;

const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Bytespider",
  "CCBot",
] as const;

export function getSeoSiteUrl(): string {
  const fromEnv = getPublicAppUrlFromEnv();
  if (fromEnv !== "http://localhost:3000") {
    return fromEnv;
  }

  return AKILI_BRAND.websiteUrl;
}

export function getSeoSiteOrigin(): URL {
  return new URL(getSeoSiteUrl());
}

export function withCanonical(path: string, metadata: Metadata): Metadata {
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      canonical: path,
    },
  };
}

export function buildOrganizationJsonLd() {
  const siteUrl = getSeoSiteUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: AKILI_BRAND.legalName,
        url: siteUrl,
        logo: `${siteUrl}/brand/akili-email-lockup.png`,
        email: AKILI_BRAND.contact.hello,
        description: AKILI_TAGLINES.platform,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: AKILI_BRAND.legalName,
        description: AKILI_TAGLINES.platform,
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
      },
    ],
  };
}

export function buildRobotsRules() {
  const disallow = [...ROBOTS_DISALLOW_PATHS];

  return [
    {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    ...AI_CRAWLER_USER_AGENTS.map((userAgent) => ({
      userAgent,
      allow: "/",
      disallow,
    })),
  ];
}
