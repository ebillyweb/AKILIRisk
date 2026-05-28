"use client";

/**
 * BRD §6.3 / Epic 5.10 US-74 — Accept-the-recommendation button.
 *
 * Client-side wrapper for the `acceptRecommendation` server action. While
 * the request is in flight the button is disabled. On success, the button
 * renders a confirmation state in place; the dashboard refreshes on the
 * next navigation to reflect the new PORTFOLIO phase.
 *
 * The action is idempotent on the server side, so a double-click cannot
 * create two engagements. The "alreadyExisted" result still surfaces as a
 * success — the client has already accepted.
 */

import { useState, useTransition } from "react";
import { acceptRecommendation } from "@/lib/actions/portfolio-engagement-actions";
import { Button } from "@/components/ui/button";

type Props = {
  assessmentId: string;
};

type LocalState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Please sign in to accept the recommendation.",
  forbidden: "You can only accept the recommendation on your own assessment.",
  not_found: "We couldn't find this assessment. Please refresh and try again.",
  wrong_phase:
    "Your Risk Profile must be published before the recommendation can be accepted.",
  no_advisor:
    "No active advisor is assigned to your account. Please contact support.",
};

export function AcceptRecommendationButton({ assessmentId }: Props) {
  const [state, setState] = useState<LocalState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setState({ kind: "submitting" });
    startTransition(async () => {
      try {
        const result = await acceptRecommendation({ assessmentId });
        if (result.ok) {
          setState({ kind: "success" });
        } else {
          setState({
            kind: "error",
            message: ERROR_MESSAGES[result.code] ?? "Something went wrong.",
          });
        }
      } catch {
        setState({
          kind: "error",
          message: "Something went wrong. Please try again.",
        });
      }
    });
  };

  if (state.kind === "success") {
    return (
      <p
        className="text-sm font-medium text-emerald-900"
        role="status"
        aria-live="polite"
      >
        ✓ Recommendation accepted. Your advisor has been notified.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={submit}
        disabled={isPending || state.kind === "submitting"}
        aria-busy={isPending || state.kind === "submitting"}
      >
        {isPending || state.kind === "submitting"
          ? "Sending…"
          : "Accept the recommendation"}
      </Button>
      {state.kind === "error" ? (
        <p
          className="text-sm font-medium text-red-700"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
