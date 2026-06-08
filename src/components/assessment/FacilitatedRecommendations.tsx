import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ClientFacilitatedRecommendation } from "@/lib/client/assessment-recommendations";
import {
  actionPlanDepthForPhase,
  implementationTypeLabel,
} from "@/lib/assessment/plan-depth";
import type { DeliverablePhase } from "@prisma/client";
import { Building2, Calendar, CircleDollarSign, Sparkles, UserRound } from "lucide-react";

type FacilitatedRecommendationsProps = {
  recommendations: ClientFacilitatedRecommendation[];
  deliverablePhase: DeliverablePhase;
};

export function FacilitatedRecommendations({
  recommendations,
  deliverablePhase,
}: FacilitatedRecommendationsProps) {
  const depth = actionPlanDepthForPhase(deliverablePhase);
  const isPortfolio = depth === "portfolio";

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="facilitated-recommendations">
      <div className="space-y-2">
        <h3 className="text-2xl font-semibold text-foreground">
          {isPortfolio ? "Risk Portfolio execution plan" : "Advisory recommendations"}
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">
          {isPortfolio
            ? "Matched services your advisory team can facilitate, including scope, timing, and implementation approach."
            : "High-level services your advisor may recommend. Detailed implementation planning and facilitated delivery unlock in your Risk Portfolio."}
        </p>
      </div>

      <div className="space-y-4">
        {recommendations.map((rec, index) => {
          const implLabel = implementationTypeLabel(rec.implementationType);

          return (
            <Card key={rec.id} className="bg-background/60">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-semibold text-foreground">
                      {index + 1}. {rec.serviceName}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {implLabel ? (
                        <Badge variant="outline" className="text-xs">
                          {implLabel}
                        </Badge>
                      ) : null}
                      {rec.tier === "ENHANCED" ? (
                        <Badge variant="secondary" className="text-xs">
                          Enhanced
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {rec.category}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {rec.description}
                  </p>
                  <p className="text-xs italic text-muted-foreground/90">
                    {rec.triggerSummary}
                  </p>
                </div>

                {rec.advisorNotes?.trim() ? (
                  <p className="border-l-2 border-brand/40 pl-3 text-sm text-foreground/90">
                    {rec.advisorNotes.trim()}
                  </p>
                ) : null}

                {isPortfolio ? (
                  <div className="grid gap-3 rounded-[1rem] border section-divider bg-background/55 p-4 text-sm sm:grid-cols-2">
                    {rec.estimatedCost ? (
                      <div className="flex items-start gap-2">
                        <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium text-foreground">
                            Estimated investment
                          </p>
                          <p className="text-muted-foreground">{rec.estimatedCost}</p>
                        </div>
                      </div>
                    ) : null}
                    {rec.timeframe ? (
                      <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Timeframe</p>
                          <p className="text-muted-foreground">{rec.timeframe}</p>
                        </div>
                      </div>
                    ) : null}
                    {rec.provider ? (
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium text-foreground">
                            Trusted advisor / provider
                          </p>
                          <p className="text-muted-foreground">{rec.provider}</p>
                        </div>
                      </div>
                    ) : null}
                    {rec.implementationType === "ADVISORY" ? (
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium text-foreground">
                            Facilitation
                          </p>
                          <p className="text-muted-foreground">
                            AKILI can coordinate delivery with vetted specialists.
                            Additional fees apply for facilitated services.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="flex items-start gap-2 rounded-[1rem] border border-dashed section-divider bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Scope, provider coordination, and investment detail are shared in
                    your Risk Portfolio after you accept the advisory recommendation.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
