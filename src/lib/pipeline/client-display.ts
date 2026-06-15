export type PipelineClientDisplayFields = {
  id: string;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
};

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

  const shortId = client.id.length > 8 ? client.id.slice(-8) : client.id;
  return `ID ${shortId}`;
}

/** Hover title for pipeline client rows — keeps email available without listing it inline. */
export function formatPipelineClientRowTitle(
  client: PipelineClientDisplayFields,
): string {
  const displayName = client.name?.trim() || "Unnamed Client";
  const secondary = formatPipelineClientSecondaryLabel(client);
  return `${displayName} · ${secondary} · ${client.email}`;
}
