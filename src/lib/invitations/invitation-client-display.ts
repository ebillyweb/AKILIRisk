import { formatClientReferenceLabel } from "@/lib/client/client-reference-code";

export const PENDING_CLIENT_REFERENCE_LABEL = "Pending registration";

export const INVITATION_SEARCH_COPY = {
  standard: {
    placeholder: "Client email or name",
    ariaLabel: "Search invitations by client email or name",
  },
  pseudonymous: {
    placeholder: "Client reference",
    ariaLabel: "Search invitations by client reference",
  },
} as const;

export function formatInvitationHistoryClientLabel(input: {
  pseudonymousWorkspaceLabeling: boolean;
  clientName?: string | null;
  prefillEmail?: string | null;
  clientReferenceCode?: string | null;
}): {
  primary: string;
  secondary: string | null;
  pseudonymous: boolean;
} {
  if (!input.pseudonymousWorkspaceLabeling) {
    return {
      primary: input.clientName?.trim() || "Not provided",
      secondary: input.prefillEmail?.trim() || null,
      pseudonymous: false,
    };
  }

  if (input.clientReferenceCode?.trim()) {
    return {
      primary: formatClientReferenceLabel(input.clientReferenceCode),
      secondary: null,
      pseudonymous: true,
    };
  }

  return {
    primary: PENDING_CLIENT_REFERENCE_LABEL,
    secondary: null,
    pseudonymous: true,
  };
}
