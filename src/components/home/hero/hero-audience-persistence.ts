import type { HeroAudience } from "@/components/home/hero/hero-audience-content";

export const HERO_AUDIENCE_STORAGE_KEY = "akili:hero-audience";
export const HERO_AUDIENCE_QUERY_KEY = "audience";

const VALID_AUDIENCES: ReadonlySet<HeroAudience> = new Set([
  "families",
  "advisors",
]);

export function isHeroAudience(value: string): value is HeroAudience {
  return VALID_AUDIENCES.has(value as HeroAudience);
}

export function parseHeroAudienceParam(
  value: string | null | undefined
): HeroAudience | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "family" || normalized === "families" || normalized === "consumer") {
    return "families";
  }
  if (normalized === "advisor" || normalized === "advisors") {
    return "advisors";
  }
  return isHeroAudience(normalized) ? normalized : null;
}

export function parseHeroAudienceHash(
  hash: string | null | undefined
): HeroAudience | null {
  if (!hash) return null;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return parseHeroAudienceParam(raw);
}

export function readHeroAudienceFromStorage(): HeroAudience | null {
  if (typeof window === "undefined") return null;
  try {
    return parseHeroAudienceParam(
      window.sessionStorage.getItem(HERO_AUDIENCE_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function writeHeroAudienceToStorage(audience: HeroAudience): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(HERO_AUDIENCE_STORAGE_KEY, audience);
  } catch {
    // Private mode or blocked storage — ignore.
  }
}

export type ResolveHeroAudienceInput = {
  search?: string;
  hash?: string;
  storage?: HeroAudience | null;
  defaultAudience?: HeroAudience;
};

/** Query param beats hash beats sessionStorage; then default. */
export function resolveHeroAudience({
  search = "",
  hash = "",
  storage = null,
  defaultAudience = "families",
}: ResolveHeroAudienceInput): HeroAudience {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  const fromQuery = parseHeroAudienceParam(
    params.get(HERO_AUDIENCE_QUERY_KEY)
  );
  if (fromQuery) return fromQuery;

  const fromHash = parseHeroAudienceHash(hash);
  if (fromHash) return fromHash;

  if (storage) return storage;

  return defaultAudience;
}

export function buildHeroAudienceSearch(audience: HeroAudience): string {
  const params = new URLSearchParams();
  params.set(HERO_AUDIENCE_QUERY_KEY, audience);
  return `?${params.toString()}`;
}

export function syncHeroAudienceToUrl(audience: HeroAudience): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(HERO_AUDIENCE_QUERY_KEY, audience);
  url.hash = "";
  const next = `${url.pathname}${url.search}`;
  window.history.replaceState(window.history.state, "", next);
}
