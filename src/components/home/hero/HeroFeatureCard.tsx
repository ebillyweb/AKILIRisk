import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HeroFeatureCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
};

export function HeroFeatureCard({
  title,
  description,
  icon: Icon,
  className,
}: HeroFeatureCardProps) {
  return (
    <Card
      className={cn(
        "group gap-0 rounded-[1.25rem] border border-border/70 bg-card/80 py-0 shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-brand/30 hover:bg-card hover:shadow-[0_12px_36px_-14px_rgba(26,24,20,0.14)]",
        className
      )}
    >
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors duration-300 group-hover:bg-brand/15">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold leading-tight text-foreground">
            {title}
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
