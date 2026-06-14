export type ContactFormIntent = "demo" | "enterprise";

export type ContactFormIntentPreset = {
  subject: string;
  message: string;
};

export const CONTACT_FORM_INTENT_PRESETS: Record<
  ContactFormIntent,
  ContactFormIntentPreset
> = {
  demo: {
    subject: "Platform demonstration request",
    message:
      "I'd like to schedule a demonstration of the AKILI advisor workspace for our firm.\n\nFirm name:\nTeam size:\nPreferred dates:",
  },
  enterprise: {
    subject: "AkiliRisk Enterprise plan inquiry",
    message:
      "I'm interested in the Enterprise plan for our firm.\n\nFirm name:\nNumber of advisors:\nApproximate client count:\nPreferred billing (wire or card):",
  },
};

export function parseContactFormIntent(
  value: string | null | undefined
): ContactFormIntent | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "demo") return "demo";
  if (normalized === "enterprise") return "enterprise";
  return null;
}

export function getContactFormIntentPreset(
  intent: ContactFormIntent | null
): ContactFormIntentPreset | null {
  if (!intent) return null;
  return CONTACT_FORM_INTENT_PRESETS[intent] ?? null;
}
