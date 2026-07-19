import { DocsPrevNext } from "@/components/docs/DocsPrevNext";
import { DocsProse } from "@/components/docs/DocsProse";
import { getAdjacentDocsPages } from "@/lib/docs";
import type { DocsPage } from "@/lib/docs/types";

const AUDIENCE_LABEL: Record<DocsPage["audience"], string> = {
  families: "For families",
  firms: "For firms",
  shared: "Families & firms",
};

type DocsArticleProps = {
  page: DocsPage;
};

export function DocsArticle({ page }: DocsArticleProps) {
  const { previous, next } = getAdjacentDocsPages(page.slug);

  return (
    <article className="space-y-8">
      <header className="space-y-4">
        <p className="editorial-kicker">{AUDIENCE_LABEL[page.audience]}</p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          {page.title}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {page.description}
        </p>
      </header>

      <DocsProse blocks={page.body} />
      <DocsPrevNext previous={previous} next={next} />
    </article>
  );
}
