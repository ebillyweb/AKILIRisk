import { Send, PlayCircle } from "lucide-react";

import { GatedClientAddButton } from "@/components/advisor/billing/ClientLimitGate";
import type { ClientLimitSnapshot } from "@/lib/billing/client-limit";

export function PipelineClientActions({
  clientLimitStatus,
}: {
  clientLimitStatus: ClientLimitSnapshot;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <GatedClientAddButton
        status={clientLimitStatus}
        href="/advisor/facilitate"
        className="inline-flex items-center gap-2"
      >
        <PlayCircle className="size-4" />
        Start live session
      </GatedClientAddButton>
      <GatedClientAddButton
        status={clientLimitStatus}
        href="/advisor/invitations"
        variant="outline"
        className="inline-flex items-center gap-2"
      >
        <Send className="size-4" />
        Send New Invitation
      </GatedClientAddButton>
    </div>
  );
}
