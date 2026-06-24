import type { CreateEmailResponse } from "resend";

/** Log Resend API failures; returns whether the send succeeded. */
export function logResendResult(
  context: string,
  result: CreateEmailResponse
): boolean {
  if (result.error) {
    console.error(`Resend API error (${context}):`, result.error);
    return false;
  }
  return true;
}
