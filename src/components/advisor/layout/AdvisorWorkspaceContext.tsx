"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SubscriptionTier } from "@prisma/client";

type AdvisorWorkspaceContextValue = {
  subscriptionTier: SubscriptionTier;
};

const AdvisorWorkspaceContext = createContext<AdvisorWorkspaceContextValue | null>(
  null,
);

export function AdvisorWorkspaceProvider({
  subscriptionTier,
  children,
}: {
  subscriptionTier: SubscriptionTier;
  children: ReactNode;
}) {
  return (
    <AdvisorWorkspaceContext.Provider value={{ subscriptionTier }}>
      {children}
    </AdvisorWorkspaceContext.Provider>
  );
}

export function useAdvisorWorkspace(): AdvisorWorkspaceContextValue {
  const value = useContext(AdvisorWorkspaceContext);
  if (!value) {
    throw new Error("useAdvisorWorkspace must be used within AdvisorWorkspaceProvider");
  }
  return value;
}
