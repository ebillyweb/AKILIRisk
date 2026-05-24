import { Card, CardContent } from "@/components/ui/card";

interface PillarNarrativeSummaryProps {
  narratives: string[];
  variant: "positive" | "developing" | "critical";
}

export function PillarNarrativeSummary({
  narratives,
  variant,
}: PillarNarrativeSummaryProps) {
  if (narratives.length === 0) {
    return null;
  }

  const cardClass =
    variant === "positive"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : variant === "developing"
        ? "border-sky-500/20 bg-sky-500/10"
        : "border-amber-500/25 bg-amber-500/10";

  const textClass =
    variant === "positive"
      ? "text-sm leading-7 text-emerald-900 dark:text-emerald-100"
      : variant === "developing"
        ? "text-sm leading-7 text-sky-950 dark:text-sky-100"
        : "text-sm leading-7 text-foreground";

  return (
    <div className="space-y-3">
      <h3 className="text-2xl font-semibold text-foreground">Pillar Summary</h3>
      {narratives.map((text, index) => (
        <Card key={index} className={cardClass}>
          <CardContent className="pt-6">
            <p className={textClass}>
              {text}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
