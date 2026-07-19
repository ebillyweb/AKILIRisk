import Link from "next/link";
import type { DocsBlock } from "@/lib/docs/types";
import { cn } from "@/lib/utils";

type DocsProseProps = {
  blocks: ReadonlyArray<DocsBlock>;
  className?: string;
};

export function DocsProse({ blocks, className }: DocsProseProps) {
  return (
    <div className={cn("space-y-6 text-base leading-7 text-foreground/90", className)}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case "paragraph":
            return (
              <p key={key} className="text-pretty text-muted-foreground">
                {block.text}
              </p>
            );
          case "heading":
            if (block.level === 2) {
              return (
                <h2
                  key={key}
                  className="font-display pt-2 text-2xl font-semibold tracking-tight text-foreground"
                >
                  {block.text}
                </h2>
              );
            }
            return (
              <h3
                key={key}
                className="pt-1 text-lg font-semibold tracking-tight text-foreground"
              >
                {block.text}
              </h3>
            );
          case "list":
            return block.ordered ? (
              <ol
                key={key}
                className="list-decimal space-y-2 pl-5 text-muted-foreground marker:text-foreground/50"
              >
                {block.items.map((item) => (
                  <li key={item} className="pl-1">
                    {item}
                  </li>
                ))}
              </ol>
            ) : (
              <ul
                key={key}
                className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-foreground/50"
              >
                {block.items.map((item) => (
                  <li key={item} className="pl-1">
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "callout":
            return (
              <aside
                key={key}
                className={cn(
                  "rounded-2xl border px-5 py-4",
                  block.tone === "note"
                    ? "border-border/70 bg-muted/35"
                    : "border-brand/25 bg-brand/5",
                )}
              >
                {block.title ? (
                  <p className="editorial-kicker mb-2 text-foreground">{block.title}</p>
                ) : null}
                <p className="text-sm leading-6 text-muted-foreground sm:text-[0.9375rem]">
                  {block.text}
                </p>
              </aside>
            );
          case "steps":
            return (
              <ol key={key} className="space-y-4">
                {block.items.map((step, stepIndex) => (
                  <li
                    key={step.title}
                    className="grid gap-3 rounded-2xl border border-border/60 bg-card/50 p-4 sm:grid-cols-[auto_1fr] sm:gap-4 sm:p-5"
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background"
                      aria-hidden
                    >
                      {stepIndex + 1}
                    </span>
                    <div className="space-y-1.5">
                      <p className="font-semibold tracking-tight text-foreground">
                        {step.title}
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground sm:text-[0.9375rem]">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            );
          case "links":
            return (
              <ul key={key} className="space-y-2">
                {block.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group flex flex-col gap-0.5 rounded-xl border border-border/60 bg-card/40 px-4 py-3 transition-colors duration-200 hover:border-border hover:bg-card/80"
                    >
                      <span className="font-medium text-foreground underline-offset-4 group-hover:underline">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="text-sm text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
