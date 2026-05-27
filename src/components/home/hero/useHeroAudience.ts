"use client";

import { useCallback, useEffect, useState } from "react";
import type { HeroAudience } from "@/components/home/hero/hero-audience-content";
import {
  readHeroAudienceFromStorage,
  resolveHeroAudience,
  syncHeroAudienceToUrl,
  writeHeroAudienceToStorage,
} from "@/components/home/hero/hero-audience-persistence";

export function useHeroAudience(initialAudience: HeroAudience = "families") {
  const [audience, setAudienceState] = useState<HeroAudience>(initialAudience);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const resolved = resolveHeroAudience({
      search: window.location.search,
      hash: window.location.hash,
      storage: readHeroAudienceFromStorage(),
      defaultAudience: initialAudience,
    });
    setAudienceState(resolved);
    writeHeroAudienceToStorage(resolved);
    syncHeroAudienceToUrl(resolved);
    setIsHydrated(true);
  }, [initialAudience]);

  const setAudience = useCallback((next: HeroAudience) => {
    setAudienceState(next);
    writeHeroAudienceToStorage(next);
    syncHeroAudienceToUrl(next);
  }, []);

  return { audience, setAudience, isHydrated };
}
