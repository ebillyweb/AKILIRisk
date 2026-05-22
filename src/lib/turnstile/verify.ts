type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export function isTurnstileConfigured(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
  );
}

/** Dev-only escape hatch when Turnstile keys are not set locally. */
export function isContactCaptchaBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.CONTACT_FORM_SKIP_CAPTCHA === "1"
  );
}

/**
 * Verifies a Cloudflare Turnstile token server-side.
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string | null
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return isContactCaptchaBypassEnabled();
  }

  if (!token?.trim()) {
    return false;
  }

  const body = new URLSearchParams({
    secret,
    response: token.trim(),
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }
    );

    if (!response.ok) {
      console.error("Turnstile verify HTTP error:", response.status);
      return false;
    }

    const data = (await response.json()) as TurnstileVerifyResponse;
    if (!data.success) {
      console.error("Turnstile verify failed:", data["error-codes"]);
    }
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verify request failed:", error);
    return false;
  }
}
