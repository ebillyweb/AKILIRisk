import { Users } from "lucide-react";

interface FacilitatedSessionBannerProps {
  clientName: string | null;
  stepLabel: string;
}

export function FacilitatedSessionBanner({
  clientName,
  stepLabel,
}: FacilitatedSessionBannerProps) {
  const displayName = clientName?.trim() || "Client";

  return (
    <div className="sticky top-0 z-40 border-b border-primary/20 bg-primary/[0.06] backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Users className="size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-foreground">
          <span className="font-medium">{stepLabel}</span>
          <span className="text-muted-foreground"> for </span>
          <span className="font-semibold">{displayName}</span>
        </p>
      </div>
    </div>
  );
}
