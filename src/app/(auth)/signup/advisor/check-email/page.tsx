import type { Metadata } from "next";
import { Suspense } from "react";

import { AdvisorCheckEmailPanel } from "@/components/auth/AdvisorCheckEmailPanel";

export const metadata: Metadata = {
  title: "Confirm your email",
  description: "Confirm your AKILI advisor account email to continue to billing.",
};

export default function AdvisorCheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AdvisorCheckEmailPanel />
    </Suspense>
  );
}
