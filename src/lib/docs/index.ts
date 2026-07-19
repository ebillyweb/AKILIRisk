import { assessmentPage } from "@/lib/docs/pages/assessment";
import { brandingPage } from "@/lib/docs/pages/branding";
import { dashboardPage } from "@/lib/docs/pages/dashboard";
import { intakePage } from "@/lib/docs/pages/intake";
import { invitationsPage } from "@/lib/docs/pages/invitations";
import { pipelinePage } from "@/lib/docs/pages/pipeline";
import { quickstartFamiliesPage } from "@/lib/docs/pages/quickstart-families";
import { quickstartFirmsPage } from "@/lib/docs/pages/quickstart-firms";
import { securityPage } from "@/lib/docs/pages/security";
import { welcomePage } from "@/lib/docs/pages/welcome";
import type { DocsNavGroup, DocsPage } from "@/lib/docs/types";

/** All documentation pages, including the hub (empty slug). */
export const DOCS_PAGES: ReadonlyArray<DocsPage> = [
  welcomePage,
  quickstartFamiliesPage,
  quickstartFirmsPage,
  intakePage,
  assessmentPage,
  dashboardPage,
  invitationsPage,
  pipelinePage,
  brandingPage,
  securityPage,
] as const;

const PAGE_BY_SLUG = new Map(DOCS_PAGES.map((page) => [page.slug, page]));

export const DOCS_NAV: ReadonlyArray<DocsNavGroup> = [
  {
    id: "get-started",
    title: "Get started",
    items: [
      { slug: "", title: "Welcome" },
      { slug: "quickstart-families", title: "Quickstart for families" },
      { slug: "quickstart-firms", title: "Quickstart for firms" },
    ],
  },
  {
    id: "families",
    title: "For families",
    items: [
      { slug: "intake", title: "Intake interview" },
      { slug: "assessment", title: "Assessment" },
      { slug: "dashboard", title: "Dashboard" },
    ],
  },
  {
    id: "firms",
    title: "For firms",
    items: [
      { slug: "invitations", title: "Invitations" },
      { slug: "pipeline", title: "Pipeline" },
      { slug: "branding", title: "Branding & white-label" },
    ],
  },
  {
    id: "account",
    title: "Account & security",
    items: [{ slug: "security", title: "Sign-in & MFA" }],
  },
] as const;

export function docsHref(slug: string): string {
  return slug ? `/docs/${slug}` : "/docs";
}

export function getDocsPage(slug: string): DocsPage | undefined {
  return PAGE_BY_SLUG.get(slug);
}

export function getDocsArticleSlugs(): string[] {
  return DOCS_PAGES.filter((page) => page.slug !== "").map((page) => page.slug);
}

export function getHubFeaturedPages(): DocsPage[] {
  return DOCS_PAGES.filter((page) => page.hubFeatured);
}

export function getAdjacentDocsPages(slug: string): {
  previous: DocsPage | null;
  next: DocsPage | null;
} {
  const flat = DOCS_NAV.flatMap((group) => group.items);
  const index = flat.findIndex((item) => item.slug === slug);
  if (index < 0) {
    return { previous: null, next: null };
  }

  const previousItem = flat[index - 1];
  const nextItem = flat[index + 1];

  return {
    previous: previousItem ? (getDocsPage(previousItem.slug) ?? null) : null,
    next: nextItem ? (getDocsPage(nextItem.slug) ?? null) : null,
  };
}

export function buildDocsLlmsTxt(siteUrl: string): string {
  const lines = [
    "# AKILI Risk Intelligence docs",
    "",
    "> How to use AKILI for families and professional firms — intake, assessment, pipeline, and branding.",
    "",
    "## Docs",
    "",
  ];

  for (const page of DOCS_PAGES) {
    const url = page.slug ? `${siteUrl}/docs/${page.slug}` : `${siteUrl}/docs`;
    lines.push(`- [${page.title}](${url}): ${page.description}`);
  }

  return `${lines.join("\n")}\n`;
}
