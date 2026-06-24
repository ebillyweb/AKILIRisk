import type { FacilitatedSessionStatus } from "@prisma/client";
import type { FacilitatedSessionSummary } from "@/lib/facilitated/types";

export type FacilitatedLauncherClient = {
  id: string;
  name: string;
  email: string;
  openSession?: {
    id: string;
    status: FacilitatedSessionStatus;
  };
};

/** Portfolio clients plus any client with an open facilitated session (open sessions first). */
export function mergeFacilitatedLauncherClients(
  portfolioClients: Array<{ id: string; name: string; email: string }>,
  openSessions: FacilitatedSessionSummary[],
): FacilitatedLauncherClient[] {
  const byId = new Map<string, FacilitatedLauncherClient>();

  for (const client of portfolioClients) {
    byId.set(client.id, { ...client });
  }

  for (const session of openSessions) {
    const openSession = { id: session.id, status: session.status };
    const existing = byId.get(session.clientId);
    if (existing) {
      existing.openSession = openSession;
      continue;
    }
    byId.set(session.clientId, {
      id: session.clientId,
      name: session.clientName ?? "Client",
      email: session.clientEmail ?? "",
      openSession,
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aHasOpen = a.openSession ? 0 : 1;
    const bHasOpen = b.openSession ? 0 : 1;
    if (aHasOpen !== bHasOpen) return aHasOpen - bHasOpen;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
