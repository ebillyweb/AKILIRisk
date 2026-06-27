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
  restrictNavToIntake: boolean;
  assessmentUnlocked: boolean;
  assessmentInProgress: boolean;
  assessmentComplete: boolean;
  canViewRiskPreview: boolean;
  canViewSummary: boolean;
  canViewActionPlan: boolean;
  responseCount: number;
  totalQuestions: number;
  mfaEnabled: boolean;
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

export function buildClientDashboardHeadline(input: BuildHubInput): {
  headline: string;
  subheadline: string;
} {
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
        "Use this page to see where you are in the process. Open Assessment Results for scores, heat maps, and reports—or return to the assessment hub to continue work in any domain.",
    };
  }

  if (input.assessmentComplete && input.canViewRiskPreview) {
    return {
      headline: "Your assessment is scored—preview is available",
      subheadline:
        "View your risk preview and domain heat map on the results pages. Your advisor will publish the full profile and action plan when ready.",
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

  return {
    headline: "Your household risk journey starts here",
    subheadline:
      "Track intake, assessment, and deliverables at a glance. Each section below links to the screen where that work happens.",
  };
}

export function buildClientDashboardJourney(
  input: BuildHubInput,
): JourneyStep[] {
  const intakeState = intakeJourneyState(input);
  const assessmentState = assessmentJourneyState(input);
  const resultsState = resultsJourneyState(input);
  const planState = actionPlanJourneyState(input);

  return [
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
    },
    {
      id: "assessment",
      label: "Assessment",
      state: assessmentState,
      detail:
        assessmentState === "locked"
          ? "Unlocks after your advisor approves intake and sets assessment scope."
          : assessmentState === "complete"
            ? "All selected domains are scored. Open the assessment hub for details."
            : assessmentState === "current"
              ? "In progress—continue pillars and autosaved answers on the Assessment page."
              : "Start your personal risk profile when intake requirements are met.",
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
    },
  ];
}

export function buildClientDashboardDestinations(
  input: BuildHubInput,
): DashboardDestination[] {
  const intakeHref = input.restrictNavToIntake
    ? "/intake"
    : input.intakeWaived || /approved|complete/i.test(input.intakeHeroLabel)
      ? "/intake/complete"
      : "/intake";

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
      "Finish all selected pillars on the Assessment page to unlock your results preview.";
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

  return [
    {
      id: "intake",
      title: "Family Governance Intake",
      description:
        "Confidential interview about household structure and governance. Start or review your submission here.",
      href: intakeHref,
      statusLabel: input.intakeHeroLabel,
      statusVariant:
        /approved|complete|waived/i.test(input.intakeHeroLabel)
          ? "success"
          : "secondary",
      icon: FileText,
      disabled: false,
      cta: input.restrictNavToIntake ? "Continue intake" : "Open intake",
    },
    {
      id: "assessment",
      title: "Personal Risk Profile",
      description:
        "Work through risk domains, track pillar progress, and resume autosaved answers. This is your main assessment workspace.",
      href: assessmentHref,
      statusLabel: assessmentStatus,
      statusVariant: assessmentDisabled
        ? "outline"
        : input.assessmentComplete
          ? "success"
          : "secondary",
      icon: ClipboardCheck,
      disabled: assessmentDisabled,
      disabledReason:
        "Your advisor must approve intake and set assessment scope before you can begin.",
      cta: input.assessmentInProgress
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
}
