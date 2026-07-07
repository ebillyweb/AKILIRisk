"use client";

import { useCallback, useEffect, useState } from "react";
import type { HeroAudience } from "@/components/home/hero/hero-audience-content";
import {
  parseHeroAudienceParam,
  readHeroAudienceFromStorage,
  resolveHeroAudience,
  syncHeroAudienceToUrl,
  writeHeroAudienceToStorage,
} from "@/components/home/hero/hero-audience-persistence";
import { heroAudiencePath } from "@/lib/marketing/friendly-urls";

export function useHeroAudience(initialAudience: HeroAudience = "families") {
  const [audience, setAudienceState] = useState<HeroAudience>(initialAudience);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const resolved = resolveHeroAudience({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      storage: readHeroAudienceFromStorage(),
      defaultAudience: initialAudience,
    });
    setAudienceState(resolved);
    writeHeroAudienceToStorage(resolved);

    const params = new URLSearchParams(window.location.search);
    const legacyAudience = parseHeroAudienceParam(params.get("audience"));
    if (legacyAudience && window.location.pathname === "/") {
      window.history.replaceState(
        window.history.state,
        "",
        heroAudiencePath(legacyAudience),
      );
    } else {
      syncHeroAudienceToUrl(resolved);
    }

    setIsHydrated(true);
  }, [initialAudience]);

  const setAudience = useCallback((next: HeroAudience) => {
    setAudienceState(next);
    writeHeroAudienceToStorage(next);
    syncHeroAudienceToUrl(next);
  }, []);

  return { audience, setAudience, isHydrated };
}
