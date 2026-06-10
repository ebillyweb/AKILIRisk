import { notFound } from "next/navigation";

import { EnterpriseTeamPanel } from "@/components/advisor/settings/EnterpriseTeamPanel";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { getEnterpriseTeamPageData } from "@/lib/enterprise/team-invite";

export default async function AdvisorTeamSettingsPage() {
  const { userId } = await requireAdvisorRole();
  const data = await getEnterpriseTeamPageData(userId);
  if (!data?.seatUsage) {
    notFound();
  }

  return (
    <EnterpriseTeamPanel
      enterpriseName={data.enterpriseName}
      role={data.role === "OWNER" ? "OWNER" : "ADMIN"}
      members={data.members}
      seatUsage={data.seatUsage}
    />
  );
}
