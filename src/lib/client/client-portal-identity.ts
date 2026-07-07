import { formatClientReferenceLabel } from "@/lib/client/client-reference-code";

export function resolveClientPortalSignedInLabel(input: {
  clientEmail: string;
  pseudonymousWorkspaceLabeling: boolean;
  clientReferenceCode: string | null;
}): string {
  if (!input.pseudonymousWorkspaceLabeling) {
    return input.clientEmail;
  }

  const code = input.clientReferenceCode?.trim();
  if (!code) {
    return input.clientEmail;
  }

  return formatClientReferenceLabel(code);
}
