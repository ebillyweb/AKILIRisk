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
        description: "Jump directly to question banks for each risk pillar.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Configuration areas",
        description:
          "Pillars, intake script, narratives, recommendation rules, preview, and version history — open any card to configure.",
        side: "top",
      },
    },
  ],
  "advisor-methodology-pillars": [
    {
      popover: {
        title: "Pillar manager",
        description:
          "Enable or disable pillars, rename labels, and set weights and score thresholds for your practice.",
      },
    },
    {
      element: '[data-tour="config-primary-form"]',
      popover: {
        title: "Pillar settings",
        description:
          "Toggle visibility, adjust display names, and configure how each pillar contributes to the overall score.",
        side: "top",
      },
    },
  ],
  "advisor-methodology-intake": [
    {
      popover: {
        title: "Intake script",
        description:
          "Edit the ordered audio interview your clients hear. Edits apply to new intakes only.",
      },
    },
    {
      element: '[data-tour="config-primary-form"]',
      popover: {
        title: "Script editor",
        description:
          "Reorder, hide, or customize platform questions. Add custom audio prompts for your clients.",
        side: "top",
      },
    },
  ],
  "advisor-methodology-questions": [
    {
      popover: {
        title: "Assessment questions",
        description:
          "Customize the personal risk profile questions clients answer for this pillar.",
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
        title: "Pillar narratives",
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
  "advisor-methodology-preview": [
    {
      popover: {
        title: "Preview as client",
        description:
          "Dry-run your live methodology without starting an intake — see pillars, questions, and rules as configured now.",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Live snapshot summary",
        description:
          "Active pillars, intake question count, and recommendation rules reflect your current configuration.",
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
          "Track platform pillar catalog changes since your profile last synced.",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Sync status",
        description:
          "Compare platform catalog version to what your profile has seen. Review new pillars when updates are available.",
        side: "top",
      },
    },
  ],
  "advisor-settings": [
    {
      popover: {
        title: "Advisor settings",
        description:
          "General, Branding, and Security tabs organize your profile, client-facing branding, and account security including PII policy.",
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
        title: "PII policy",
        description:
          "Choose which optional client PII fields future clients are asked during intake.",
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
        title: "Team management",
        description:
          "Invite team members, manage access, and monitor seat usage for your firm.",
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
        title: "Rules by pillar",
        description:
          "Each pillar card shows how many firm rules exist. Open Manage to edit triggers for that risk area.",
        side: "top",
      },
    },
  ],
} satisfies Record<string, TourStepDefinition[]>;
