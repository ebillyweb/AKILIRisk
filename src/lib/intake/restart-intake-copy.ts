export type RestartIntakeBlockReason =
  | "assignment_inactive"
  | "intake_waived"
  | "assessment_started"
  | "facilitated_session_open";

export function restartIntakeBlockedMessage(
  reason: RestartIntakeBlockReason,
): string {
  switch (reason) {
    case "assignment_inactive":
      return "Restore this client workflow before restarting intake.";
    case "intake_waived":
      return "Intake was waived for this client. Remove the waiver before restarting intake.";
    case "assessment_started":
      return "Intake cannot be restarted after the assessment has started.";
    case "facilitated_session_open":
      return "Finish or cancel the open live session before restarting intake.";
  }
}
