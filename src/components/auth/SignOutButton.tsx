"use client";

import type { ComponentProps } from "react";
import { performClientSignOut } from "@/lib/auth/client-sign-out";
import { Button } from "@/components/ui/button";

type SignOutButtonProps = Omit<ComponentProps<typeof Button>, "type" | "onClick"> & {
  /** Where to land after sign-out. Defaults to the current page (full reload). */
  redirectTo?: string;
};

/**
 * Client sign-out so the session cookie and header stay in sync.
 * Uses Auth.js redirect (full navigation) instead of a soft RSC refresh.
 */
export function SignOutButton({
  redirectTo,
  children = "Sign Out",
  ...buttonProps
}: SignOutButtonProps) {
  async function handleSignOut() {
    const pathname =
      typeof window !== "undefined" ? window.location.pathname : undefined;
    await performClientSignOut({ redirectTo, pathname });
  }

  return (
    <Button type="button" onClick={() => void handleSignOut()} {...buttonProps}>
      {children}
    </Button>
  );
}
