import type { TourStepDefinition } from "@/lib/product-tour/types";

export const ADVISOR_PIPELINE_TOURS = {
  "advisor-pipeline": [
    {
      popover: {
        title: "Clients",
        description:
          "Track every household from invitation through assessment completion. Use this view to see who needs your attention and drill into individual workflows.",
      },
    },
    {
      element: '[data-tour="pipeline-client-actions"]',
      popover: {
        title: "Add clients",
        description:
          "Start a live session with someone in your portfolio or add a household on the spot. For self-service onboarding, send an email invitation instead.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="pipeline-overview"]',
      popover: {
        title: "Pipeline overview",
        description:
          "Counts by stage — Invited, Registered, Intake, Assessment, and Completed — show how your book is distributed across the workflow.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="pipeline-filters"]',
      popover: {
        title: "Find and focus",
        description:
          "Search by name or email, switch between active and inactive workflows, filter by stage, or use the Intake chip for submitted intakes awaiting your review. Other workflow queues are in the sidebar.",
        side: "top",
      },
    },
    {
      element: '[data-tour="pipeline-live-status"]',
      popover: {
        title: "Live updates",
        description:
          "The pipeline refreshes automatically as clients move through stages — no manual reload needed.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="pipeline-table"]',
      popover: {
        title: "Client list",
        description:
          "Each row shows stage, progress, and last activity. Click a client to open their full workflow — intake, assessment, documents, and reports.",
        side: "top",
      },
    },
  ],
  "advisor-pipeline-client": [
    {
      popover: {
        title: "Client workflow",
        description:
          "This page is the command center for one household — see where they are, what they still owe you, and take the next action.",
      },
    },
    {
      element: '[data-tour="pipeline-client-header"]',
      popover: {
        title: "Status and progress",
        description:
          "The stage badge shows their current workflow step. The progress bar reflects how far they have moved from invitation to completion.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="pipeline-workflow-timeline"]',
      popover: {
        title: "Workflow timeline",
        description:
          "A chronological log of key events — registration, intake submission, assessment milestones, and document activity.",
        side: "top",
      },
    },
    {
      element: '[data-tour="pipeline-intake"]',
      popover: {
        title: "Intake",
        description:
          "Clients complete governance intake before the assessment unlocks. Review submitted responses, export a PDF, or waive intake when you are intentionally skipping the interview.",
        side: "top",
      },
    },
    {
      element: '[data-tour="pipeline-assessment"]',
      popover: {
        title: "Risk assessment",
        description:
          "Scores, risk level, and per risk domain heat map appear here once the client progresses. Open analytics, review answers, or export results when assessment is complete.",
        side: "top",
      },
    },
    {
      element: '[data-tour="pipeline-stale-scores-alert"]',
      popover: {
        title: "Stale scores vs reassessment",
        description:
          "If answers changed after completion, scores need a re-score (admin recalculates from the same assessment). Reassessment is separate: the client completes a new linked assessment so you can compare improvement over time.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="pipeline-documents"]',
      popover: {
        title: "Document requirements",
        description:
          "Define mandatory or optional documents for this client. Outstanding requirements can block workflow progression until uploaded.",
        side: "left",
      },
    },
    {
      element: '[data-tour="pipeline-quick-actions"]',
      popover: {
        title: "Quick actions",
        description:
          "End or restore the workflow, return to the pipeline list, open analytics, or manage versioned reports for this client.",
        side: "left",
      },
    },
  ],
} satisfies Record<string, TourStepDefinition[]>;
