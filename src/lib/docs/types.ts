export type DocsAudience = "families" | "firms" | "shared";

export type DocsBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | {
      type: "callout";
      tone?: "info" | "note";
      title?: string;
      text: string;
    }
  | {
      type: "steps";
      items: ReadonlyArray<{ title: string; body: string }>;
    }
  | {
      type: "links";
      items: ReadonlyArray<{ label: string; href: string; description?: string }>;
    };

export type DocsPage = {
  /** Empty string for the hub at `/docs`. */
  slug: string;
  title: string;
  description: string;
  audience: DocsAudience;
  /** Shown in the hub feature grid when true. */
  hubFeatured?: boolean;
  /** One-line summary for hub cards and sidebar context. */
  summary: string;
  body: ReadonlyArray<DocsBlock>;
};

export type DocsNavItem = {
  slug: string;
  title: string;
};

export type DocsNavGroup = {
  id: string;
  title: string;
  items: ReadonlyArray<DocsNavItem>;
};
