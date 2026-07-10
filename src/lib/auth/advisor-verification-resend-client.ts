export type AdvisorVerificationResendStatus = "idle" | "sending" | "sent" | "error";

export type AdvisorVerificationResendResult =
  | { ok: true }
  | { ok: false; error: string };

export type AdvisorVerificationResendOptions = {
  checkoutPlan?: string;
  checkoutCycle?: string;
};

export async function resendAdvisorVerificationEmail(
  email: string,
  options?: AdvisorVerificationResendOptions
): Promise<AdvisorVerificationResendResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, error: "Enter your email address first." };
  }

  try {
    const res = await fetch("/api/auth/advisor-signup/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalized,
        checkoutPlan: options?.checkoutPlan,
        checkoutCycle: options?.checkoutCycle,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? "Could not resend the email. Try again later.",
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not resend the email. Try again later." };
  }
}
