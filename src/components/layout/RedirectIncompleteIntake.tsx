"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  scopePathToCurrentTenant,
  stripTenantPathPrefix,
} from "@/lib/client/tenant-path-prefix-client";

interface RedirectIncompleteIntakeProps {
  restrictNavToIntake: boolean;
}

export function RedirectIncompleteIntake({ restrictNavToIntake }: RedirectIncompleteIntakeProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!restrictNavToIntake) return;
    const appPath = stripTenantPathPrefix(pathname);
    if (
      appPath === "/intake" ||
      appPath.startsWith("/intake/") ||
      appPath === "/support" ||
      appPath.startsWith("/support/")
    ) {
      return;
    }
    router.replace(scopePathToCurrentTenant("/intake", pathname));
  }, [restrictNavToIntake, pathname, router]);

  return null;
}
