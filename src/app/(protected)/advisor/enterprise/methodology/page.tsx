import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  FileText,
  Layers,
  Sparkles,
} from "lucide-react";

import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { loadActiveEnterpriseMethodologyPillars } from "@/lib/methodology/enterprise-methodology-queries";
import { methodologyPillarDisplayName } from "@/lib/methodology/methodology-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";
import { ENTERPRISE_METHODOLOGY_HUB_LINKS } from "@/lib/advisor/enterprise-methodology-hub-links";

export default async function EnterpriseMethodologyHubPage() {
  let enterpriseName: string;
  let enterpriseId: string;
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    enterpriseName = team.enterpriseName;
    enterpriseId = team.enterpriseId;
  } catch {
    redirect("/signin");
  }

  const pillars = await loadActiveEnterpriseMethodologyPillars(enterpriseId);

  return (
    <div className="space-y-8">
      <ConfigurationPageHeader
        tourId="advisor-methodology-hub"
        title={`${enterpriseName} — Practice Standards`}
        description="Applies to all advisors in your firm. Changes sync to member profiles."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Assessment questions by risk domain
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {pillars.map((pillar) => (
            <Button key={pillar.pillarId} variant="outline" size="sm" asChild>
              <Link href={`/advisor/enterprise/methodology/questions/${pillar.slug}`}>
                {methodologyPillarDisplayName(pillar)}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {ENTERPRISE_METHODOLOGY_HUB_LINKS.map((item) => {
          const Icon =
            item.href.includes("/risk-domains")
              ? Layers
              : item.href.includes("/intake")
                ? ClipboardList
                : item.href.includes("/narratives")
                  ? FileText
                  : Sparkles;
          return (
            <Card key={item.href} className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <Button size="sm" asChild>
                  <Link href={item.href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
