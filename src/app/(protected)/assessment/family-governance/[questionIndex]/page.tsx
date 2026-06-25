import { redirect } from "next/navigation";
import { normalizePillarSlug, isAssessmentPillarId } from "@/lib/assessment/pillar-registry";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";

interface LegacyPillarRedirectProps {
  params: Promise<{ pillarSlug: string; questionIndex: string }>;
}

/**
 * Redirect legacy pillar slugs to canonical six-pillar routes.
 */
export default async function LegacyPillarRedirect({ params }: LegacyPillarRedirectProps) {
  const { pillarSlug, questionIndex } = await params;
  const normalized = normalizePillarSlug(pillarSlug);
  const catalog = await getPlatformPillarCatalog();

  if (isAssessmentPillarId(normalized, catalog) && normalized !== pillarSlug) {
    redirect(`/assessment/${normalized}/${questionIndex}`);
  }

  redirect("/assessment");
}
