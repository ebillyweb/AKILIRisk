import { MarketingSurfaceCard } from "@/components/marketing/MarketingSurfaceCard";
import type { LegalSection } from "@/lib/legal/documents";
import { cn } from "@/lib/utils";

type MarketingProseSectionsProps = {
  sections: LegalSection[];
  variant?: "plain" | "cards";
  className?: string;
};

export function MarketingProseSections({
  sections,
  variant = "plain",
  className,
}: MarketingProseSectionsProps) {
  if (variant === "cards") {
    return (
      <div
        className={cn(
          "grid gap-6 sm:gap-8 md:grid-cols-2",
          className,
        )}
      >
        {sections.map((section, index) => (
          <section
            key={section.id}
            id={section.id}
            className={cn(
              "scroll-mt-24",
              index === sections.length - 1 &&
                sections.length % 2 === 1 &&
                "md:col-span-2 md:max-w-2xl md:justify-self-center md:w-full",
            )}
          >
            <MarketingSurfaceCard className="h-full space-y-4">
              <SectionContent section={section} />
            </MarketingSurfaceCard>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-10 sm:space-y-12", className)}>
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-24 space-y-4"
        >
          <SectionContent section={section} />
        </section>
      ))}
    </div>
  );
}

function SectionContent({ section }: { section: LegalSection }) {
  return (
    <>
      <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        {section.title}
      </h2>
      <div className="space-y-4">
        {section.paragraphs.map((paragraph, index) => (
          <p
            key={`${section.id}-${index}`}
            className="text-base leading-7 text-muted-foreground"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </>
  );
}
