import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { docsHref } from "@/lib/docs";
import type { DocsPage } from "@/lib/docs/types";

type DocsPrevNextProps = {
  previous: DocsPage | null;
  next: DocsPage | null;
};

export function DocsPrevNext({ previous, next }: DocsPrevNextProps) {
  if (!previous && !next) return null;

  return (
    <nav
      className="mt-12 grid gap-3 border-t border-border/60 pt-8 sm:grid-cols-2"
      aria-label="Adjacent documentation pages"
    >
      {previous ? (
        <Link
          href={docsHref(previous.slug)}
          className="group flex flex-col gap-1 rounded-2xl border border-border/60 bg-card/40 px-4 py-4 transition-colors duration-200 hover:border-border hover:bg-card/80 sm:px-5"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden />
            Previous
          </span>
          <span className="font-medium text-foreground">{previous.title}</span>
        </Link>
      ) : (
        <div className="hidden sm:block" />
      )}
      {next ? (
        <Link
          href={docsHref(next.slug)}
          className="group flex flex-col gap-1 rounded-2xl border border-border/60 bg-card/40 px-4 py-4 text-right transition-colors duration-200 hover:border-border hover:bg-card/80 sm:items-end sm:px-5"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Next
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </span>
          <span className="font-medium text-foreground">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
