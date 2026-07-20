import type {
  DashboardDestination,
  JourneyStep,
  JourneyStepState,
} from "@/components/dashboard/ClientDashboardOverview";
import {
  ClipboardCheck,
  FileText,
  ListTodo,
  Settings,
  Shield,
  Users,
} from "lucide-react";

type BuildHubInput = {
  intakeHeroLabel: string;
  intakeWaived: boolean;
  hasSubmittedInterview: boolean;
  intakeAnswersLocked: boolean;
  restrictNavToIntake: boolean;
  assessmentUnlocked: boolean;
  /** Waived intake but advisor has not selected assessment domains yet. */
  assessmentScopePending: boolean;
  assessmentInProgress: boolean;
  assessmentComplete: boolean;
  canViewRiskPreview: boolean;
  canViewSummary: boolean;
  canViewActionPlan: boolean;
  /** When false, hide action plan journey step and destination card. */
  actionPlanEnabled: boolean;
  responseCount: number;
  totalQuestions: number;
  mfaEnabled: boolean;
  /** Advisor landing copy for the default dashboard welcome state. */
  portalCopy?: {
    tagline?: string | null;
    landingHeadline?: string | null;
    landingSubheadline?: string | null;
  };
};

function intakeJourneyState(input: BuildHubInput): JourneyStepState {
  if (input.intakeWaived) return "complete";
  if (/approved|complete|waived/i.test(input.intakeHeroLabel)) return "complete";
  if (/in progress|not started/i.test(input.intakeHeroLabel)) return "current";
  if (/review|pending|update needed/i.test(input.intakeHeroLabel)) {
    return "waiting";
  }
  return "upcoming";
}

function assessmentJourneyState(input: BuildHubInput): JourneyStepState {
  if (!input.assessmentUnlocked) return "locked";
  if (input.assessmentComplete) return "complete";
  if (input.assessmentInProgress) return "current";
  return "upcoming";
}

function resultsJourneyState(input: BuildHubInput): JourneyStepState {
  if (!input.assessmentUnlocked || !input.assessmentComplete) return "locked";
  if (input.canViewSummary) return "complete";
  if (input.canViewRiskPreview) return "current";
  return "waiting";
}

function actionPlanJourneyState(input: BuildHubInput): JourneyStepState {
  if (!input.assessmentUnlocked || !input.assessmentComplete) return "locked";
  if (input.canViewActionPlan) return "complete";
  return "waiting";
}

function resolveIntakeHref(input: BuildHubInput): string {
  if (input.intakeWaived) {
    return input.assessmentUnlocked ? "/assessment" : "/intake";
  }
  if (input.intakeAnswersLocked && input.hasSubmittedInterview) {
    return "/intake/review";
  }
  if (input.restrictNavToIntake) {
    return "/intake";
  }
  if (/approved|complete/i.test(input.intakeHeroLabel)) {
    return "/intake/complete";
  }
  return "/intake";
}

export function buildClientDashboardHeadline(input: BuildHubInput): {
  headline: string;
  subheadline: string;
} {
  if (input.intakeWaived) {
    if (input.assessmentScopePending) {
      return {
        headline: "Your advisor skipped the intake interview",
        subheadline:
          "The family governance intake was bypassed for your household. Your advisor is finishing assessment setup—you will be able to start your personal risk profile once domains are selected.",
      };
    }

    if (!input.assessmentUnlocked) {
      return {
        headline: "Your advisor skipped the intake interview",
        subheadline:
          "The family governance intake was bypassed for your household. Your advisor will unlock your personal risk profile when setup is complete.",
      };
    }

    if (input.assessmentComplete && input.canViewSummary) {
      return {
        headline: "Your risk profile is ready to review",
        subheadline:
          "Your advisor waived the intake interview, so you went straight to the personal risk profile. Open Assessment Results for scores, heat maps, and reports.",
      };
    }

    if (input.assessmentComplete && input.canViewRiskPreview) {
      return {
        headline: "Your assessment is scored—preview is available",
        subheadline: input.actionPlanEnabled
          ? "Your advisor waived the intake interview. Open Risk Preview while your advisor finalizes the full profile and action plan."
          : "Your advisor waived the intake interview. Open Risk Preview while your advisor finalizes your profile.",
      };
    }

    if (input.assessmentComplete) {
      return {
        headline: "Your assessment is complete",
        subheadline:
          "Your advisor waived the intake interview. Scoring just finished—Risk Preview unlocks shortly, then your advisor publishes the full profile.",
      };
    }

    if (input.assessmentInProgress) {
      const pct =
        input.totalQuestions > 0
          ? Math.round((input.responseCount / input.totalQuestions) * 100)
          : 0;
      return {
        headline: "Continue your personal risk profile",
        subheadline: `Your advisor skipped the intake interview—you're about ${pct}% through the assessment. Open Personal Risk Profile below to pick up where you left off.`,
      };
    }

    return {
      headline: "Your advisor skipped the intake interview",
      subheadline:
        "The family governance intake was bypassed for your household. You can begin your personal risk profile directly—open Personal Risk Profile below when you're ready.",
    };
  }

  if (input.restrictNavToIntake) {
    return {
      headline: "Start with your family governance intake",
      subheadline:
        "Complete the intake interview first. Your advisor uses it to scope the personal risk profile and unlock the rest of your portal.",
    };
  }

  if (!input.assessmentUnlocked) {
    return {
      headline: "Your intake is under advisor review",
      subheadline:
        "You can see high-level status here. Detailed questionnaires and scoring live on their dedicated pages once your advisor approves your intake.",
    };
  }

  if (input.assessmentComplete && input.canViewSummary) {
    return {
      headline: "Your risk profile is ready to review",
      subheadline:
        "Open Assessment Results for scores, heat maps, and reports. Your advisor can help prioritize next steps on the action plan.",
    };
  }

  if (input.assessmentComplete && input.canViewRiskPreview) {
    return {
      headline: "Your assessment is scored—preview is available",
      subheadline: input.actionPlanEnabled
        ? "Open Risk Preview to see scored domains and top risks. Your advisor will publish the full profile and action plan when ready."
        : "Open Risk Preview to see scored domains and top risks. Your advisor will publish your full profile when ready.",
    };
  }

  if (input.assessmentComplete) {
    return {
      headline: "Your assessment is complete",
      subheadline:
        "Scoring just finished. Open your dashboard destinations below—Risk Preview unlocks as soon as scores are ready, then your advisor publishes the full profile.",
    };
  }

  if (input.assessmentInProgress) {
    const pct =
      input.totalQuestions > 0
        ? Math.round((input.responseCount / input.totalQuestions) * 100)
        : 0;
    return {
      headline: "Continue your personal risk profile",
      subheadline: `You're about ${pct}% through the assessment. This dashboard summarizes your status—open Personal Risk Profile for pillar-by-pillar progress and to pick up where you left off.`,
    };
  }

  return applyDefaultPortalCopy(
    {
      headline: "Your household risk journey starts here",
      subheadline:
        "Track intake, assessment, and deliverables at a glance. Each section below links to the screen where that work happens.",
    },
    input.portalCopy,
  );
}

function applyDefaultPortalCopy(
  copy: { headline: string; subheadline: string },
  portalCopy: BuildHubInput["portalCopy"],
): { headline: string; subheadline: string } {
  if (!portalCopy) return copy;

  const headline = portalCopy.landingHeadline?.trim();
  const subheadline =
    portalCopy.landingSubheadline?.trim() || portalCopy.tagline?.trim();

  return {
    headline: headline || copy.headline,
    subheadline: subheadline || copy.subheadline,
  };
}

export function buildClientDashboardJourney(
  input: BuildHubInput,
): JourneyStep[] {
  const destinations = buildClientDashboardDestinations(input);
  const linkById = new Map(
    destinations.map((destination) => [
      destination.id,
      {
        href: destination.href,
        disabled: destination.disabled,
        disabledReason: destination.disabledReason,
      },
    ]),
  );

  const intakeState = intakeJourneyState(input);
  const assessmentState = assessmentJourneyState(input);
  const resultsState = resultsJourneyState(input);
  const planState = actionPlanJourneyState(input);

  const steps: JourneyStep[] = [
    {
      id: "intake",
      label: "Intake",
      state: intakeState,
      detail:
        input.intakeWaived
          ? "Waived by your advisor—you can go straight to the assessment."
          : intakeState === "complete"
            ? `Status: ${input.intakeHeroLabel}.`
            : intakeState === "current"
              ? "Complete the family governance interview on the Intake page."
              : intakeState === "waiting"
                ? `Status: ${input.intakeHeroLabel}. Your advisor is reviewing your submission.`
                : "Begin on the Intake page when you're ready.",
      href: resolveIntakeHref(input),
      disabled: false,
      disabledReason: undefined,
    },
    {
      id: "assessment",
      label: "Assessment",
      state: assessmentState,
      detail:
        assessmentState === "locked"
          ? input.intakeWaived || input.assessmentScopePending
            ? "Unlocks after your advisor sets assessment scope."
            : "Unlocks after your advisor approves intake and sets assessment scope."
          : assessmentState === "complete"
            ? "All selected domains are scored. Open Risk Preview or Results for what to do next."
            : assessmentState === "current"
              ? "In progress—continue risk domains and autosaved answers on the Assessment page."
              : "Start your personal risk profile when intake requirements are met.",
      href: linkById.get("assessment")?.href ?? "/assessment",
      disabled: linkById.get("assessment")?.disabled,
      disabledReason: linkById.get("assessment")?.disabledReason,
    },
    {
      id: "results",
      label: "Results",
      state: resultsState,
      detail:
        resultsState === "locked"
          ? "Available after you complete the assessment."
          : resultsState === "complete"
            ? "Full results, reports, and domain summaries are on Assessment Results."
            : resultsState === "current"
              ? "Risk preview and heat map are on the Risk Preview page."
              : "Your advisor will publish your full risk profile soon.",
      href: linkById.get("results")?.href ?? "/assessment/results",
      disabled: linkById.get("results")?.disabled,
      disabledReason: linkById.get("results")?.disabledReason,
    },
    {
      id: "action-plan",
      label: "Action plan",
      state: planState,
      detail:
        planState === "locked"
          ? "Opens when your advisor publishes recommendations."
          : planState === "complete"
            ? "Review prioritized recommendations on your Action Plan page."
            : "Your advisor is preparing tailored next steps.",
      href: linkById.get("action-plan")?.href ?? "/dashboard/action-plan",
      disabled: linkById.get("action-plan")?.disabled,
      disabledReason: linkById.get("action-plan")?.disabledReason,
    },
  ];

  if (!input.actionPlanEnabled) {
    return steps.filter((step) => step.id !== "action-plan");
  }

  return steps;
}

export function buildClientDashboardDestinations(
  input: BuildHubInput,
): DashboardDestination[] {
  const intakeHref = resolveIntakeHref(input);

  const intakeDescription =
    input.intakeAnswersLocked && input.hasSubmittedInterview
      ? "Your submitted answers are read-only now that your assessment has started."
      : input.intakeWaived
        ? "Your advisor bypassed the family governance intake interview for your household. You can go straight to your personal risk profile."
        : "Confidential interview about household structure and governance. Start or review your submission here.";

  const intakeCta =
    input.intakeAnswersLocked && input.hasSubmittedInterview
      ? "View intake answers"
      : input.restrictNavToIntake
        ? "Continue intake"
        : input.intakeWaived
          ? input.assessmentUnlocked
            ? "Open assessment"
            : "Learn more"
          : "Open intake";

  let resultsHref = "/assessment/results";
  let resultsDisabled = !input.assessmentUnlocked || !input.assessmentComplete;
  let resultsStatus = "Not ready";
  let resultsVariant: DashboardDestination["statusVariant"] = "outline";
  let resultsCta = "View results";
  let resultsDescription =
    "Domain scores, heat maps, and downloadable reports live here—not on this overview.";

  if (input.canViewSummary) {
    resultsStatus = "Published";
    resultsVariant = "success";
    resultsDisabled = false;
  } else if (input.canViewRiskPreview) {
    resultsHref = "/assessment/risk-preview";
    resultsStatus = "Preview ready";
    resultsVariant = "warning";
    resultsDisabled = false;
    resultsCta = "View risk preview";
    resultsDescription =
      "See your scored domains and top risks while your advisor finalizes the full profile.";
  } else if (input.assessmentComplete && input.assessmentUnlocked) {
    resultsStatus = "Awaiting publish";
    resultsVariant = "secondary";
    resultsDisabled = true;
    resultsDescription =
      "Your assessment is scored. Your advisor will notify you when the full results are published.";
  } else if (input.assessmentInProgress && input.assessmentUnlocked) {
    resultsStatus = "In progress";
    resultsVariant = "secondary";
    resultsDisabled = true;
    resultsDescription =
      "Finish all selected risk domains on the Assessment page to unlock your results preview.";
  }

  const assessmentHref = "/assessment";
  const assessmentDisabled = !input.assessmentUnlocked;
  const assessmentStatus = !input.assessmentUnlocked
    ? "Locked"
    : input.assessmentComplete
      ? "Complete"
      : input.assessmentInProgress
        ? "In progress"
        : "Ready to start";

  const destinations: DashboardDestination[] = [
    {
      id: "intake",
      title: "Family Governance Intake",
      description: intakeDescription,
      href: intakeHref,
      statusLabel: input.intakeWaived
        ? "Bypassed"
        : input.intakeHeroLabel,
      statusVariant:
        input.intakeWaived || /approved|complete|waived/i.test(input.intakeHeroLabel)
          ? "success"
          : "secondary",
      icon: FileText,
      disabled: false,
      cta: intakeCta,
    },
    {
      id: "assessment",
      title: "Personal Risk Profile",
      description:
        input.assessmentComplete
          ? "Domains are scored. Use Assessment Results (or Risk Preview) for the recommended next step—not this hub."
          : "Work through risk domains, track pillar progress, and resume autosaved answers. This is your main assessment workspace.",
      href: assessmentHref,
      statusLabel: assessmentStatus,
      statusVariant: assessmentDisabled
        ? "outline"
        : input.assessmentComplete
          ? "success"
          : "secondary",
      icon: ClipboardCheck,
      disabled: assessmentDisabled,
      disabledReason: input.assessmentScopePending
        ? "Your advisor is selecting risk domains before you can begin."
        : input.intakeWaived
          ? "Your advisor is finishing assessment setup before you can begin."
          : "Your advisor must approve intake and set assessment scope before you can begin.",
      cta: input.assessmentComplete
        ? "Open assessment hub"
        : input.assessmentInProgress
          ? "Continue assessment"
          : "Open assessment hub",
    },
    {
      id: "results",
      title: "Assessment Results",
      description: resultsDescription,
      href: resultsHref,
      statusLabel: resultsStatus,
      statusVariant: resultsVariant,
      icon: Shield,
      disabled: resultsDisabled,
      disabledReason:
        "Complete the assessment and wait for scoring to view results.",
      cta: resultsCta,
    },
    {
      id: "action-plan",
      title: "Strategic Action Plan",
      description:
        input.canViewActionPlan
          ? "Prioritized recommendations and implementation guidance from your advisor."
          : "Your advisor will publish prioritized recommendations here after your risk profile is ready.",
      href: "/dashboard/action-plan",
      statusLabel: input.canViewActionPlan ? "Available" : "Pending",
      statusVariant: input.canViewActionPlan ? "success" : "outline",
      icon: ListTodo,
      cta: input.canViewActionPlan
        ? "View action plan"
        : "Open action plan",
    },
    {
      id: "profiles",
      title: "Household Profiles",
      description:
        "Manage family member profiles and governance roles used across intake and assessment.",
      href: "/profiles",
      statusLabel: "Household",
      statusVariant: "secondary",
      icon: Users,
      cta: "Manage profiles",
    },
    {
      id: "settings",
      title: "Security & Access",
      description:
        "Review sign-in email, enable two-factor authentication, and manage account security.",
      href: "/settings",
      statusLabel: input.mfaEnabled ? "MFA on" : "MFA off",
      statusVariant: input.mfaEnabled ? "success" : "warning",
      icon: Settings,
      cta: "Account settings",
    },
  ];

  if (!input.actionPlanEnabled) {
    return destinations.filter((destination) => destination.id !== "action-plan");
  }

  return destinations;
}
