export type ContactFormIntent = "demo";

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
};

export function parseContactFormIntent(
  value: string | null | undefined
): ContactFormIntent | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "demo") return "demo";
  return null;
}

export function getContactFormIntentPreset(
  intent: ContactFormIntent | null
): ContactFormIntentPreset | null {
  if (!intent) return null;
  return CONTACT_FORM_INTENT_PRESETS[intent] ?? null;
}
