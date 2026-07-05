import type { TourStepDefinition } from "@/lib/product-tour/types";

/** Single-step intro tours for advisor hub screens without dedicated walkthroughs. */
export const ADVISOR_HUB_TOURS = {
  "advisor-leads": [
    {
      popover: {
        title: "Assessment leads",
        description:
          "Prospects assigned to you by the AKILI team. Follow up, then invite them when you are ready to start intake.",
      },
    },
  ],
  "advisor-engagements": [
    {
      popover: {
        title: "Engagements",
        description:
          "Track clients who accepted recommendations. Advance status as you schedule meetings and complete work.",
      },
    },
  ],
  "advisor-signals": [
    {
      popover: {
        title: "Signals",
        description:
          "Portfolio risk and workflow events from the last 90 days — critical and moderate items surfaced for review.",
      },
    },
  ],
  "advisor-reports": [
    {
      popover: {
        title: "Reports",
        description:
          "Published client deliverables across your book. Open a report to review or share with the household.",
      },
    },
  ],
  "advisor-recommendations-hub": [
    {
      popover: {
        title: "Recommendations",
        description:
          "Remediation services matched from completed assessments. Annotate and publish via each client report editor.",
      },
    },
  ],
  "advisor-facilitate": [
    {
      popover: {
        title: "Client sessions",
        description:
          "Run facilitated intake and assessment with a client in the room — progress saves as you go.",
      },
    },
  ],
  "advisor-reassessment": [
    {
      popover: {
        title: "Reassessment cadence",
        description:
          "Clients due for a fresh assessment based on your practice cadence and last completed score date.",
      },
    },
  ],
  "advisor-invitations": [
    {
      popover: {
        title: "Invitations",
        description:
          "Send assessment invitations and track registration status for new households joining your pipeline.",
      },
    },
  ],
  "advisor-billing": [
    {
      popover: {
        title: "Billing",
        description:
          "Your subscription plan, seat usage, and Stripe invoices for the advisor workspace.",
      },
    },
  ],
  "advisor-intelligence": [
    {
      popover: {
        title: "Risk intelligence",
        description:
          "Portfolio-level risk patterns and governance vulnerability highlights across assigned clients.",
      },
    },
  ],
  "advisor-notifications": [
    {
      popover: {
        title: "Notifications",
        description:
          "Client activity, workflow updates, and priority alerts for your practice.",
      },
    },
  ],
  "advisor-workspace-fallback": [
    {
      popover: {
        title: "Advisor workspace",
        description:
          "Use the sidebar to move between clients, workflow tools, methodology, and settings for your firm.",
      },
    },
  ],
} satisfies Record<string, TourStepDefinition[]>;
