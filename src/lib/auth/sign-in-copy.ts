import type { SignInRole } from "@/lib/auth/sign-in-roles";

export function clientSignInPanelDescription(firmName?: string | null): string {
  if (firmName) {
    return `Enter the email your ${firmName} advisor used for your account. We'll send a one-time sign-in link — no password required.`;
  }
  return "Enter the email your advisor used for your account. We'll send a one-time sign-in link — no password required.";
}

export function advisorSignInPanelDescription(firmName?: string | null): string {
  if (firmName) {
    return `Sign in to your ${firmName} advisor workspace to manage client profiles, assessments, and recommendations.`;
  }
  return "Sign in to manage client profiles, assessments, and recommendations from your advisor workspace.";
}

export function signInHubDescription(firmName?: string | null): string {
  if (firmName) {
    return `Sign in to ${firmName} as a client or advisor.`;
  }
  return "Choose your account type, then continue with the sign-in method for that role.";
}

export function coerceSignInRoleForBrandedPortal(role: SignInRole): SignInRole {
  return role === "admin" ? "advisor" : role;
}
