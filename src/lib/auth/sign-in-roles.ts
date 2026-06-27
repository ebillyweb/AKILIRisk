export type SignInRole = "client" | "advisor" | "admin";

export const SIGN_IN_ROLES: ReadonlyArray<{
  id: SignInRole;
  label: string;
  shortLabel: string;
}> = [
  { id: "client", label: "Client", shortLabel: "Client" },
  { id: "advisor", label: "Advisor", shortLabel: "Advisor" },
  { id: "admin", label: "Platform admin", shortLabel: "Admin" },
] as const;

export function isSignInRole(value: string | null | undefined): value is SignInRole {
  return value === "client" || value === "advisor" || value === "admin";
}
