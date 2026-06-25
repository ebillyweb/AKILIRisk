"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ADMIN_ASSESSMENT_QUESTIONS_PATH,
  adminAssessmentQuestionsAreaPath,
} from "@/lib/admin/assessment-questions-paths";
import type { PillarCatalogEntry } from "@/lib/methodology/pillar-catalog";
import { sortPillarCatalog } from "@/lib/methodology/pillar-catalog";
import { Button } from "@/components/ui/button";

type Props = {
  /** `null` when viewing the “all pillars” index. */
  activeAreaId: string | null;
  pillars: PillarCatalogEntry[];
};

export function QuestionBankRiskAreaFilter({ activeAreaId, pillars }: Props) {
  const searchParams = useSearchParams();
  const areas = sortPillarCatalog(pillars);

  const hrefForArea = (id: string) => {
    const next = new URLSearchParams(searchParams.toString());
    const qs = next.toString();
    return `${adminAssessmentQuestionsAreaPath(id)}${qs ? `?${qs}` : ""}`;
  };

  return (
    <nav
      className="flex flex-wrap items-center gap-1.5"
      aria-label="Risk area"
    >
      <Button variant={activeAreaId === null ? "default" : "outline"} size="sm" asChild>
        <Link
          href={ADMIN_ASSESSMENT_QUESTIONS_PATH}
          aria-current={activeAreaId === null ? "page" : undefined}
        >
          All risk areas
        </Link>
      </Button>
      {areas.map((a) => {
        const active = activeAreaId === a.id;
        return (
          <Button key={a.id} variant={active ? "default" : "outline"} size="sm" asChild>
            <Link href={hrefForArea(a.id)} aria-current={active ? "page" : undefined}>
              {a.name}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
