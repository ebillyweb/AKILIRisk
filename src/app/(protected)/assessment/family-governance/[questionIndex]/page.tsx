import { redirect } from "next/navigation";
import { normalizePillarSlug, isAssessmentPillarId } from "@/lib/assessment/pillar-registry";

interface LegacyPillarRedirectProps {
  params: Promise<{ pillarSlug: string; questionIndex: string }>;
}

/**
 * Redirect legacy pillar slugs to canonical six-pillar routes.
 */
export default async function LegacyPillarRedirect({ params }: LegacyPillarRedirectProps) {
  const { pillarSlug, questionIndex } = await params;
  const normalized = normalizePillarSlug(pillarSlug);

  if (isAssessmentPillarId(normalized) && normalized !== pillarSlug) {
    redirect(`/assessment/${normalized}/${questionIndex}`);
  }

  redirect("/assessment");
}
