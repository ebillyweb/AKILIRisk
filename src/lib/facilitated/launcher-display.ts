import type { PipelineClient } from "@/lib/pipeline/types";
import { resolveAdvisorClientPipelineLabels } from "@/lib/pipeline/client-display";
import type { FacilitatedLauncherClient } from "@/lib/facilitated/launcher-clients";
import type { FacilitatedSessionSummary } from "@/lib/facilitated/types";

export function mapPipelineClientToLauncherClient(
  client: PipelineClient,
): FacilitatedLauncherClient {
  const labels = resolveAdvisorClientPipelineLabels(client);
  return {
    id: client.id,
    name: labels.headline,
    email: labels.pseudonymous ? "" : client.email,
    secondary: labels.secondary,
    pseudonymous: labels.pseudonymous,
  };
}

export function resolveFacilitatedSessionClientDisplayName(
  session: Pick<FacilitatedSessionSummary, "clientId" | "clientDisplayName">,
  pipelineById: Map<string, PipelineClient>,
): string {
  if (session.clientDisplayName?.trim()) {
    return session.clientDisplayName;
  }
  const pipelineClient = pipelineById.get(session.clientId);
  if (pipelineClient) {
    return resolveAdvisorClientPipelineLabels(pipelineClient).headline;
  }
  return "Client";
}

export function formatFacilitatedLauncherClientOption(
  client: FacilitatedLauncherClient,
): string {
  const openSuffix = client.openSession ? " — open session" : "";
  if (client.pseudonymous) {
    return `${client.name}${openSuffix}`;
  }

  const parts = [client.name];
  if (client.secondary?.trim()) {
    parts.push(client.secondary.trim());
  } else if (client.email.trim()) {
    parts.push(client.email.trim());
  }
  return `${parts.join(" · ")}${openSuffix}`;
}
