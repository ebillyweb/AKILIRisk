import Link from "next/link";
import { docsHref, getHubFeaturedPages } from "@/lib/docs";
import { DocsProse } from "@/components/docs/DocsProse";
import type { DocsPage } from "@/lib/docs/types";

type DocsHubProps = {
  page: DocsPage;
};

const AUDIENCE_LABEL: Record<DocsPage["audience"], string> = {
  families: "Families",
  firms: "Firms",
  shared: "Everyone",
};

export function DocsHub({ page }: DocsHubProps) {
  const featured = getHubFeaturedPages();

  return (
    <article className="space-y-10">
      <header className="space-y-4">
        <p className="editorial-kicker">Documentation</p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          AKILI docs
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {page.description}
        </p>
      </header>

      <DocsProse blocks={page.body} />

      <section className="space-y-5" aria-labelledby="docs-featured-heading">
        <div className="space-y-1">
          <p className="editorial-kicker">Explore</p>
          <h2
            id="docs-featured-heading"
            className="font-display text-2xl font-semibold tracking-tight text-foreground"
          >
            Core guides
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {featured.map((feature) => (
            <Link
              key={feature.slug}
              href={docsHref(feature.slug)}
              className="group flex flex-col gap-3 rounded-[1.5rem] border border-border/60 bg-card/50 p-5 transition-colors duration-200 hover:border-border hover:bg-card/90 sm:p-6"
            >
              <span className="editorial-kicker !normal-case !tracking-[0.08em] text-muted-foreground">
                {AUDIENCE_LABEL[feature.audience]}
              </span>
              <span className="font-display text-xl font-semibold tracking-tight text-foreground underline-offset-4 group-hover:underline">
                {feature.title}
              </span>
              <span className="text-sm leading-6 text-muted-foreground">
                {feature.summary}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
