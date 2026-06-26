import type { TourStepDefinition } from "@/lib/product-tour/types";

/** Recommendation rule tours (admin + advisor + enterprise). */
export const RECOMMENDATION_RULES_TOURS = {
  "admin-recommendation-rules-list": [
    {
      popover: {
        title: "Recommendation rules",
        description:
          "Rules connect assessment results to services in your catalog. When a client's scores match a rule, that service is suggested in their action plan.",
      },
    },
    {
      element: '[data-tour="config-primary-list"]',
      popover: {
        title: "Your rule library",
        description:
          "Each row is one rule. Open a rule to edit when it should fire, which service it recommends, and how important it is.",
        side: "top",
      },
    },
    {
      element: '[data-tour="config-primary-action"]',
      popover: {
        title: "Create a new rule",
        description: "Start here to define triggers in plain language.",
        side: "left",
      },
    },
  ],
  "admin-recommendation-rule-form": [
    {
      popover: {
        title: "Build a matching rule",
        description:
          "A rule links a catalog service to client situations that should trigger it.",
      },
    },
    {
      element: '[data-tour="rule-service"]',
      popover: {
        title: "Pick a service",
        description: "Choose the catalog service this rule should surface when it matches.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="rule-name"]',
      popover: {
        title: "Name the rule",
        description: "Use a short internal name your team will recognize.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="rule-conditions"]',
      popover: {
        title: "When should this fire?",
        description:
          "Add checks for pillar score, risk level, or intake answers. The rule matches when more than half of the importance weight is satisfied.",
        side: "top",
      },
    },
    {
      element: '[data-tour="rule-priority"]',
      popover: {
        title: "Priority",
        description: "Higher priority rules surface first when several rules match.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="rule-active"]',
      popover: {
        title: "Active toggle",
        description: "Turn off a rule to keep it on file without affecting new assessments.",
        side: "left",
      },
    },
  ],
  "advisor-recommendation-rules": [
    {
      popover: {
        title: "Your recommendation rules",
        description:
          "These rules decide which services are suggested after an assessment. Settings apply to new intakes and are frozen when an intake starts.",
      },
    },
    {
      element: '[data-tour="config-page-header"]',
      popover: {
        title: "Pillar-specific rules",
        description: "Each risk pillar has its own rule set. Switch pillars with the pills below.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="rules-existing"]',
      popover: {
        title: "Platform, firm, and custom rules",
        description:
          "Platform rules come from Akili. Firm defaults apply if your enterprise set them. Custom rules are yours to delete.",
        side: "top",
      },
    },
    {
      element: '[data-tour="rule-conditions"]',
      popover: {
        title: "Configure when a rule fires",
        description: "Edit checks for any rule, then click Save rule.",
        side: "top",
      },
    },
    {
      element: '[data-tour="rule-create"]',
      popover: {
        title: "Add a custom rule",
        description: "Pick a service, name the rule, and define your own triggers.",
        side: "top",
      },
    },
  ],
  "enterprise-recommendation-rules": [
    {
      popover: {
        title: "Firm-wide recommendation defaults",
        description:
          "Rules you set here become defaults for every advisor in your firm. Members can still adjust their own copies.",
      },
    },
    {
      element: '[data-tour="config-page-header"]',
      popover: {
        title: "Pillar-specific defaults",
        description: "Switch pillars to manage firm defaults for each risk area.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="rules-existing"]',
      popover: {
        title: "Inherited and custom rules",
        description: "Platform rules are the Akili baseline. Firm custom rules sync to all members.",
        side: "top",
      },
    },
    {
      element: '[data-tour="rule-conditions"]',
      popover: {
        title: "Set firm trigger conditions",
        description: "Define when this service should be recommended for the whole firm.",
        side: "top",
      },
    },
    {
      element: '[data-tour="rule-create"]',
      popover: {
        title: "Add a firm custom rule",
        description: "Create a firm-wide rule with your own triggers and service link.",
        side: "top",
      },
    },
  ],
} satisfies Record<string, TourStepDefinition[]>;
