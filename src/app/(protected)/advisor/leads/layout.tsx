import type { ReactNode } from "react";

import { requireAdvisorAssessmentLeadsMemberAccess } from "@/lib/platform/advisor-feature-guards";

export default async function AdvisorLeadsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdvisorAssessmentLeadsMemberAccess();
  return children;
}
