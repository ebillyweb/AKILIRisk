import { formatClientReferenceLabel } from "@/lib/client/client-reference-code";

export type PipelineClientDisplayFields = {
  id: string;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  clientReferenceCode?: string | null;
  /** When true, workspace UI shows Client CL-… references for every client. */
  pseudonymousWorkspaceLabeling?: boolean;
};

/** Short pseudonymous label (Client CL-… reference). */
export function formatPipelineClientShortId(
  client: Pick<PipelineClientDisplayFields, "clientReferenceCode">,
): string {
  if (!client.clientReferenceCode?.trim()) {
    throw new Error("clientReferenceCode is required for pseudonymous display");
  }
  return formatClientReferenceLabel(client.clientReferenceCode);
}

/** True when the advisor can show a legal name distinct from the sign-in email. */
export function clientHasDistinctLegalName(
  name: string | null | undefined,
  email: string,
): boolean {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === "Unnamed Client") return false;
  if (trimmed.includes("@")) return false;
  return trimmed.toLowerCase() !== email.toLowerCase();
}

export function usesPseudonymousClientLabeling(
  client: Pick<PipelineClientDisplayFields, "pseudonymousWorkspaceLabeling">,
): boolean {
  return client.pseudonymousWorkspaceLabeling === true;
}

/** Label used for pipeline search and name sort when identity is hidden. */
export function pipelineClientSortSearchLabel(
  client: PipelineClientDisplayFields,
): string {
  if (client.pseudonymousWorkspaceLabeling) {
    return client.clientReferenceCode?.trim() || client.id;
  }
  return client.name?.trim() || client.email;
}

/** Advisor-facing headline/subline for pipeline rows and client detail headers. */
export function resolveAdvisorClientPipelineLabels(
  client: PipelineClientDisplayFields,
): {
  headline: string;
  secondary: string | null;
  metaEmail: string | null;
  pseudonymous: boolean;
} {
  const pseudonymousWorkspaceLabeling =
    client.pseudonymousWorkspaceLabeling === true;

  if (pseudonymousWorkspaceLabeling) {
    return {
      headline: formatPipelineClientShortId(client),
      secondary: null,
      metaEmail: null,
      pseudonymous: true,
    };
  }

  const displayName = client.name?.trim() || "Unnamed Client";
  const hasDistinctName = clientHasDistinctLegalName(displayName, client.email);

  if (hasDistinctName) {
    return {
      headline: displayName,
      secondary: formatPipelineClientSecondaryLabel(client),
      metaEmail: client.email,
      pseudonymous: false,
    };
  }

  return {
    headline: client.email,
    secondary: formatPipelineClientSecondaryLabel(client),
    metaEmail: null,
    pseudonymous: false,
  };
}

function formatFirstNameLastInitial(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  const first = firstName?.trim();
  if (!first) return null;

  const last = lastName?.trim();
  if (last && last.length > 0) {
    return `${first} ${last[0]!.toUpperCase()}.`;
  }

  return first;
}

function formatFirstNameLastInitialFromFullName(
  name: string | null | undefined,
): string | null {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.includes("@")) return null;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;

  const first = parts[0]!;
  const lastInitial = parts[parts.length - 1]![0]?.toUpperCase();
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

/** Short, non-email secondary label for pipeline rows. */
export function formatPipelineClientSecondaryLabel(
  client: PipelineClientDisplayFields,
): string {
  const fromParts = formatFirstNameLastInitial(client.firstName, client.lastName);
  if (fromParts) return fromParts;

  const fromName = formatFirstNameLastInitialFromFullName(client.name);
  if (fromName) return fromName;

  return formatPipelineClientShortId(client);
}

/** Hover title for pipeline client rows. Omits email when pseudonymous labeling is on. */
export function formatPipelineClientRowTitle(
  client: PipelineClientDisplayFields,
): string {
  const { headline, secondary, pseudonymous } =
    resolveAdvisorClientPipelineLabels(client);
  const parts = [headline, secondary];
  if (!pseudonymous) {
    parts.push(client.email);
  }
  return parts.filter(Boolean).join(" · ");
}
