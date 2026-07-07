"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { HeroAudience } from "@/components/home/hero/hero-audience-content";
import { useHeroAudience } from "@/components/home/hero/useHeroAudience";

type HeroAudienceContextValue = {
  audience: HeroAudience;
  setAudience: (audience: HeroAudience) => void;
  isHydrated: boolean;
};

const HeroAudienceContext = createContext<HeroAudienceContextValue | null>(null);

type HeroAudienceProviderProps = {
  initialAudience?: HeroAudience;
  children: ReactNode;
};

export function HeroAudienceProvider({
  initialAudience = "families",
  children,
}: HeroAudienceProviderProps) {
  const value = useHeroAudience(initialAudience);

  return (
    <HeroAudienceContext.Provider value={value}>
      {children}
    </HeroAudienceContext.Provider>
  );
}

export function useOptionalHeroAudience(): HeroAudienceContextValue | null {
  return useContext(HeroAudienceContext);
}

export function useHeroAudienceNav(): HeroAudienceContextValue {
  const context = useContext(HeroAudienceContext);
  if (!context) {
    throw new Error("useHeroAudienceNav requires HeroAudienceProvider");
  }
  return context;
}
