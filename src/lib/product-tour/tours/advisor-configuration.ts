import type { TourStepDefinition } from "@/lib/product-tour/types";

export const ADVISOR_CONFIGURATION_TOURS = {
  "advisor-methodology-hub": [
    {
      popover: {
        title: "Methodology hub",
        description:
          "Configure your household risk methodology. Changes apply to new intakes only — in-flight clients keep their snapshotted configuration.",
      },
    },
    {
      element: '[data-tour="config-pillar-questions"]',
      popover: {
        title: "Assessment questions",
        description: "Jump directly to question banks for each risk domain.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Configuration areas",
        description:
          "Risk domains, intake question bank, narratives, recommendation rules, preview, and version history — open any card to configure.",
        side: "top",
      },
    },
  ],
  "advisor-methodology-pillars": [
    {
      popover: {
        title: "Risk domain manager",
        description:
          "Enable or disable pillars, rename labels, and set weights and score thresholds for your practice.",
      },
    },
    {
      element: '[data-tour="config-primary-form"]',
      popover: {
        title: "Risk domain settings",
        description:
          "Toggle visibility, adjust display names, and configure how each risk domain contributes to the overall score.",
        side: "top",
      },
    },
  ],
  "advisor-methodology-intake": [
    {
      popover: {
        title: "Intake question bank",
        description:
          "Choose platform or custom intake questions for the audio interview. Edits apply to new intakes only.",
      },
    },
    {
      element: '[data-tour="config-primary-form"]',
      popover: {
        title: "Question bank editor",
        description:
          "Switch between platform and custom banks, then edit, hide, or add questions for your clients.",
        side: "top",
      },
    },
  ],
  "advisor-methodology-questions": [
    {
      popover: {
        title: "Assessment questions",
        description:
          "Customize the personal risk profile questions clients answer for this risk domain.",
      },
    },
    {
      element: '[data-tour="config-primary-form"]',
      popover: {
        title: "Question editor",
        description:
          "Edit, hide, or add custom questions. Changes apply to new intakes only.",
        side: "top",
      },
    },
  ],
  "advisor-methodology-narratives": [
    {
      popover: {
        title: "Risk domain narratives",
        description:
          "Outcome copy shown in score reports and PDFs for low, mid, and high maturity bands.",
      },
    },
    {
      element: '[data-tour="config-primary-form"]',
      popover: {
        title: "Narrative editor",
        description:
          "Customize bullet points for each score band. Snapshotted when clients start intake.",
        side: "top",
      },
    },
  ],
  "advisor-methodology-versions": [
    {
      popover: {
        title: "Pinned versions",
        description:
          "Intake snapshots frozen when clients start their interview. Review what configuration each client received.",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Snapshot history",
        description:
          "Each row links a client intake to the methodology version they were assessed against.",
        side: "top",
      },
    },
  ],
  "advisor-methodology-catalog-updates": [
    {
      popover: {
        title: "Catalog updates",
        description:
          "Track platform risk domain catalog changes since your profile last synced.",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Sync status",
        description:
          "Compare platform catalog version to what your profile has seen. Review new risk domains when updates are available.",
        side: "top",
      },
    },
  ],
  "advisor-settings": [
    {
      popover: {
        title: "Advisor settings",
        description:
          "General, Branding, and Security tabs organize your profile, client-facing branding, and account security including client data policy.",
      },
    },
    {
      element: '[data-tour="config-branding-tab"]',
      popover: {
        title: "Branding tab",
        description:
          "Open Branding to edit firm name, logo, colors, and contact details for client-facing emails and reports.",
        side: "bottom",
      },
    },
  ],
  "advisor-settings-pii-policy": [
    {
      popover: {
        title: "Client data policy",
        description:
          "Choose optional intake fields and whether clients appear by legal name or Client CL-… reference in your workspace.",
      },
    },
    {
      element: '[data-tour="config-primary-form"]',
      popover: {
        title: "Field toggles",
        description:
          "Every field is enabled by default. Disable fields you do not want to collect from new clients.",
        side: "top",
      },
    },
  ],
  "advisor-settings-team": [
    {
      popover: {
        title: "Team",
        description:
          "Invite team members, manage roles, and monitor seat usage for your firm.",
      },
    },
    {
      element: '[data-tour="config-primary-action"]',
      popover: {
        title: "Invite members",
        description: "Send invitations for team members to join your firm.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Team roster",
        description: "View active members, pending invites, and suspend or reactivate access.",
        side: "top",
      },
    },
  ],
  "advisor-settings-access-control": [
    {
      popover: {
        title: "Roles & Permissions",
        description:
          "Configure workspace visibility, client data defaults, household profiles, and branding for team members.",
      },
    },
    {
      element: '[data-tour="config-advisor-visibility"]',
      popover: {
        title: "Team member settings",
        description:
          "Choose which sidebar areas team members see, how client data is labeled, and what they can customize for clients.",
        side: "top",
      },
    },
  ],
  "enterprise-recommendation-rules-index": [
    {
      popover: {
        title: "Firm recommendation rules",
        description:
          "Set firm-wide defaults for which services are suggested after assessments.",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Rules by risk domain",
        description:
          "Each pillar card shows how many firm rules exist. Open Manage to edit triggers for that risk area.",
        side: "top",
      },
    },
  ],
} satisfies Record<string, TourStepDefinition[]>;
