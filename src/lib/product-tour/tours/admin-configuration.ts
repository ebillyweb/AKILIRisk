import type { TourStepDefinition } from "@/lib/product-tour/types";

export const ADMIN_CONFIGURATION_TOURS = {
  "admin-recommendation-catalog": [
    {
      popover: {
        title: "Service catalog",
        description:
          "These are the services your recommendation rules can suggest. Each entry describes what clients might do to reduce risk.",
      },
    },
    {
      element: '[data-tour="config-filters"]',
      popover: {
        title: "Filter the catalog",
        description: "Narrow by category, tier, complexity, or search by name.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Catalog entries",
        description:
          "Open any service to edit its description, tier, and priority. The Rules column shows how many matching rules reference it.",
        side: "top",
      },
    },
    {
      element: '[data-tour="config-primary-action"]',
      popover: {
        title: "Add a service",
        description: "Create a new catalog entry before linking rules to it.",
        side: "left",
      },
    },
  ],
  "admin-recommendation-service-form": [
    {
      popover: {
        title: "Service details",
        description:
          "Define what clients see when this service is recommended in their action plan.",
      },
    },
    {
      element: '[data-tour="config-primary-form"]',
      popover: {
        title: "Core fields",
        description:
          "Name, description, and category help advisors understand the service. Tier and complexity guide prioritization.",
        side: "top",
      },
    },
  ],
  "admin-intake-questions": [
    {
      popover: {
        title: "Intake question bank",
        description:
          "These questions are spoken aloud during the client audio interview. Order and visibility control the live script.",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Intake questions",
        description:
          "Each row is one interview prompt. Hide questions to skip them; edit copy and order from the edit screen.",
        side: "top",
      },
    },
  ],
  "admin-intake-question-edit": [
    {
      popover: {
        title: "Edit intake question",
        description: "Changes apply to new interview loads immediately.",
      },
    },
    {
      element: '[data-tour="config-primary-form"]',
      popover: {
        title: "Question copy",
        description:
          "Update the spoken question, optional context, recording tips, and which pillars this question relates to.",
        side: "top",
      },
    },
  ],
  "admin-assessment-questions-index": [
    {
      popover: {
        title: "Assessment question bank",
        description:
          "Personal risk profile questions are organized by risk pillar. Pick a pillar to manage its question set.",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Risk pillars",
        description:
          "Each card shows how many questions are visible vs. total. Open a pillar to edit, reorder, or hide questions.",
        side: "top",
      },
    },
  ],
  "admin-assessment-questions-area": [
    {
      popover: {
        title: "Pillar question list",
        description:
          "Manage assessment questions for this risk area. Visibility and order affect new assessments.",
      },
    },
    {
      element: '[data-tour="config-filters"]',
      popover: {
        title: "Filter by type",
        description: "Focus on a specific question type when reviewing a long bank.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="config-primary-action"]',
      popover: {
        title: "Add a question",
        description: "Create a new assessment question for this pillar.",
        side: "left",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Question rows",
        description:
          "Reorder with arrows, toggle visibility, or open edit to change copy and scoring metadata.",
        side: "top",
      },
    },
  ],
  "admin-assessment-question-form": [
    {
      popover: {
        title: "Question editor",
        description:
          "Define the assessment prompt, answer type, and scoring behavior for this pillar.",
      },
    },
    {
      element: '[data-tour="config-primary-form"]',
      popover: {
        title: "Question fields",
        description:
          "Question text, section, display order, and visibility control how clients experience this item.",
        side: "top",
      },
    },
  ],
  "admin-scoring-thresholds": [
    {
      popover: {
        title: "Risk label cutoffs",
        description:
          "Platform-wide score lines that label assessment results as low, medium, high, or urgent.",
      },
    },
    {
      element: '[data-tour="config-primary-form"]',
      popover: {
        title: "Threshold values",
        description:
          "Set minimum scores for each band. Advisors and clients see these labels on dashboards and reports.",
        side: "top",
      },
    },
  ],
  "admin-platform-settings": [
    {
      popover: {
        title: "Platform settings",
        description:
          "Configure security policy and advisor-facing feature flags for the whole platform.",
      },
    },
    {
      element: '[data-tour="config-password-policy"]',
      popover: {
        title: "Password policy",
        description:
          "Minimum length and complexity rules. Affected users are prompted to update passwords when requirements change.",
        side: "top",
      },
    },
    {
      element: '[data-tour="config-feature-flags"]',
      popover: {
        title: "Advisor feature flags",
        description:
          "Toggle governance dashboard, risk intelligence, and workflow features for all advisors.",
        side: "top",
      },
    },
  ],
} satisfies Record<string, TourStepDefinition[]>;
