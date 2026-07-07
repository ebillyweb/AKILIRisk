import type { Metadata } from "next";

import { AKILI_BRAND, AKILI_TAGLINES } from "@/lib/brand/tokens";
import { getBusinessContact } from "@/lib/marketing/business-contact";
import { getConfiguredSocialProfileUrls } from "@/lib/marketing/social-profiles";
import { getPublicAppUrlFromEnv } from "@/lib/public-app-url";

export const DEFAULT_PUBLIC_DESCRIPTION =
  "Governance intelligence platform for modern family wealth — structured assessments, prioritized risks, and actionable recommendations for professional firms and families.";

export type PublicSitemapEntry = {
  path: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
};

/** Public marketing routes included in sitemap.xml and allowed in robots.txt. */
export const PUBLIC_SITEMAP_ENTRIES: PublicSitemapEntry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/families", changeFrequency: "monthly", priority: 0.85 },
  { path: "/firms", changeFrequency: "monthly", priority: 0.85 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.85 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact/demo", changeFrequency: "monthly", priority: 0.75 },
  { path: "/contact/enterprise", changeFrequency: "monthly", priority: 0.75 },
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

function resolveMetadataTitle(metadata: Metadata, fallback: string): string {
  const title = metadata.title;
  if (typeof title === "string") return title;
  if (title && typeof title === "object") {
    if ("absolute" in title && title.absolute) return title.absolute;
    if ("default" in title && title.default) return title.default;
  }
  return fallback;
}

function resolveOpenGraphTitle(metadata: Metadata): string {
  const title = resolveMetadataTitle(metadata, AKILI_BRAND.legalName);
  if (title === AKILI_BRAND.legalName || title.includes("|")) {
    return title;
  }
  return `${title} | ${AKILI_BRAND.legalName}`;
}

function resolveMetadataDescription(metadata: Metadata): string {
  if (typeof metadata.description === "string" && metadata.description.trim()) {
    return metadata.description;
  }
  return DEFAULT_PUBLIC_DESCRIPTION;
}

export function buildSocialMetadata(
  metadata: Pick<Metadata, "title" | "description" | "openGraph" | "twitter"> = {},
): Pick<Metadata, "openGraph" | "twitter"> {
  const title = resolveOpenGraphTitle(metadata);
  const description = resolveMetadataDescription(metadata);

  return {
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: AKILI_BRAND.legalName,
      title,
      description,
      ...metadata.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...metadata.twitter,
    },
  };
}

export function withCanonical(path: string, metadata: Metadata): Metadata {
  const social = buildSocialMetadata(metadata);

  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      canonical: path,
    },
    openGraph: {
      ...social.openGraph,
      ...metadata.openGraph,
      url: path,
    },
    twitter: {
      ...social.twitter,
      ...metadata.twitter,
    },
  };
}

export function buildOrganizationJsonLd() {
  const siteUrl = getSeoSiteUrl();
  const sameAs = getConfiguredSocialProfileUrls();
  const businessContact = getBusinessContact();

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: AKILI_BRAND.legalName,
      url: siteUrl,
      logo: `${siteUrl}/brand/akili-email-lockup.png`,
      email: AKILI_BRAND.contact.hello,
      description: AKILI_TAGLINES.platform,
      ...(businessContact ? { telephone: businessContact.phone } : {}),
      ...(sameAs.length > 0 ? { sameAs } : {}),
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
  ];

  if (businessContact) {
    graph.push({
      "@type": "LocalBusiness",
      "@id": `${siteUrl}/#localbusiness`,
      name: AKILI_BRAND.legalName,
      url: siteUrl,
      telephone: businessContact.phone,
      email: AKILI_BRAND.contact.hello,
      description: AKILI_TAGLINES.platform,
      address: {
        "@type": "PostalAddress",
        streetAddress: businessContact.address.streetAddress,
        addressLocality: businessContact.address.addressLocality,
        addressRegion: businessContact.address.addressRegion,
        postalCode: businessContact.address.postalCode,
        addressCountry: businessContact.address.addressCountry,
      },
      parentOrganization: {
        "@id": `${siteUrl}/#organization`,
      },
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
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
