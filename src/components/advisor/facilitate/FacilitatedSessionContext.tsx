"use client";

import { createContext, useContext } from "react";

export type FacilitatedSessionContextValue = {
  sessionId: string;
  clientName: string | null;
  assessmentId: string | null;
};

const FacilitatedSessionContext = createContext<FacilitatedSessionContextValue | null>(
  null,
);

export function FacilitatedSessionProvider({
  value,
  children,
}: {
  value: FacilitatedSessionContextValue;
  children: React.ReactNode;
}) {
  return (
    <FacilitatedSessionContext.Provider value={value}>
      {children}
    </FacilitatedSessionContext.Provider>
  );
}

export function useFacilitatedSessionContext(): FacilitatedSessionContextValue {
  const ctx = useContext(FacilitatedSessionContext);
  if (!ctx) {
    throw new Error("useFacilitatedSessionContext requires FacilitatedSessionProvider");
  }
  return ctx;
}
