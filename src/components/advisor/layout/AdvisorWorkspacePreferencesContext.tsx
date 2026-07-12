"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { EnterpriseAdvisorMemberVisibility } from "@/lib/enterprise/advisor-member-visibility";

export type AdvisorWorkspacePreferences = {
  productToursEnabled: boolean;
  applyEnterpriseMemberVisibility: boolean;
  enterpriseMemberVisibility: EnterpriseAdvisorMemberVisibility;
};

const defaultPreferences: AdvisorWorkspacePreferences = {
  productToursEnabled: true,
  applyEnterpriseMemberVisibility: false,
  enterpriseMemberVisibility: {
    portfolio: true,
    assessmentLeads: true,
    methodology: true,
    engagements: true,
    reassessment: true,
    productTours: true,
    hideTierLockedNav: false,
    skipIntake: false,
    skipPostIntakeReview: false,
    documentRequirements: true,
    actionPlan: true,
    sharedClientVisibility: false,
  },
};

const AdvisorWorkspacePreferencesContext =
  createContext<AdvisorWorkspacePreferences>(defaultPreferences);

export function AdvisorWorkspacePreferencesProvider({
  value,
  children,
}: {
  value: AdvisorWorkspacePreferences;
  children: ReactNode;
}) {
  return (
    <AdvisorWorkspacePreferencesContext.Provider value={value}>
      {children}
    </AdvisorWorkspacePreferencesContext.Provider>
  );
}

export function useAdvisorWorkspacePreferences(): AdvisorWorkspacePreferences {
  return useContext(AdvisorWorkspacePreferencesContext);
}
