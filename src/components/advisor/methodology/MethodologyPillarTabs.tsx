import Link from "next/link";

import { methodologyPillarDisplayName } from "@/lib/methodology/methodology-queries";
import { Button } from "@/components/ui/button";

type MethodologyPillarTab = {
  pillarId: string;
  slug: string;
  canonicalName: string;
  displayName: string | null;
};

export function MethodologyPillarTabs({
  pillars,
  activeSlug,
  hrefForSlug,
}: {
  pillars: MethodologyPillarTab[];
  activeSlug: string;
  hrefForSlug: (slug: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {pillars.map((pillar) => (
        <Button
          key={pillar.pillarId}
          variant={pillar.slug === activeSlug ? "default" : "outline"}
          size="sm"
          asChild
        >
          <Link href={hrefForSlug(pillar.slug)}>
            {methodologyPillarDisplayName(pillar)}
          </Link>
        </Button>
      ))}
    </div>
  );
}
