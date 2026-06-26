import { NextRequest, NextResponse } from "next/server";

import { resolveAdvisorCheckoutIntentForEmail } from "@/lib/advisor/checkout-billing-redirect";
import { signIn } from "@/lib/auth";
import { validateAdvisorEmailVerificationToken } from "@/lib/auth/advisor-email-verification";
import {
  advisorBillingDeepLink,
  parseSignupCheckoutIntent,
} from "@/lib/billing/tier-catalog";

function failureUrl(req: NextRequest, reason: string): URL {
  const url = new URL("/signup/advisor/verify-failed", req.url);
  url.searchParams.set("reason", reason);
  return url;
}

function readCheckoutSearchParam(
  params: URLSearchParams,
  name: "checkout_plan" | "checkout_cycle"
): string | null {
  const direct = params.get(name);
  if (direct) return direct;
  // Email clients that copy HTML entity text literally produce keys like "amp;checkout_plan".
  return params.get(`amp;${name}`);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(failureUrl(req, "not_found"));
  }

  const validation = await validateAdvisorEmailVerificationToken(token);
  if (!validation.success) {
    return NextResponse.redirect(failureUrl(req, validation.reason));
  }

  const redirectTo = await resolvePostVerifyRedirect(req, validation.email);

  const signInResult = await signIn("advisor-email-verify", {
    token,
    redirect: false,
  });

  if (typeof signInResult === "string" && signInResult.includes("error")) {
    return NextResponse.redirect(failureUrl(req, "sign_in_failed"));
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
}

async function resolvePostVerifyRedirect(
  req: NextRequest,
  email: string
): Promise<string> {
  const params = req.nextUrl.searchParams;
  const urlIntent = parseSignupCheckoutIntent({
    checkout_plan: readCheckoutSearchParam(params, "checkout_plan"),
    checkout_cycle: readCheckoutSearchParam(params, "checkout_cycle"),
  });
  if (urlIntent) {
    return advisorBillingDeepLink(urlIntent.tier, urlIntent.billingCycle);
  }

  const dbIntent = await resolveAdvisorCheckoutIntentForEmail(email);
  if (dbIntent) {
    return advisorBillingDeepLink(dbIntent.tier, dbIntent.billingCycle);
  }

  return "/advisor/billing?notice=subscription_required";
}
