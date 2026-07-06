export type SocialProfileId = "linkedin" | "facebook" | "instagram" | "x" | "youtube";

export type SocialProfile = {
  id: SocialProfileId;
  label: string;
  href: string;
};

const SOCIAL_ENV_KEYS: Record<SocialProfileId, string> = {
  linkedin: "NEXT_PUBLIC_SOCIAL_LINKEDIN_URL",
  facebook: "NEXT_PUBLIC_SOCIAL_FACEBOOK_URL",
  instagram: "NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL",
  x: "NEXT_PUBLIC_SOCIAL_X_URL",
  youtube: "NEXT_PUBLIC_SOCIAL_YOUTUBE_URL",
};

const SOCIAL_LABELS: Record<SocialProfileId, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  youtube: "YouTube",
};

function normalizeSocialUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function getConfiguredSocialProfiles(): SocialProfile[] {
  return (Object.keys(SOCIAL_ENV_KEYS) as SocialProfileId[])
    .map((id) => {
      const href = normalizeSocialUrl(process.env[SOCIAL_ENV_KEYS[id]]);
      if (!href) return null;
      return { id, label: SOCIAL_LABELS[id], href };
    })
    .filter((profile): profile is SocialProfile => profile !== null);
}

export function getConfiguredSocialProfileUrls(): string[] {
  return getConfiguredSocialProfiles().map((profile) => profile.href);
}

export function getFacebookPixelId(): string | undefined {
  const trimmed = process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim();
  return trimmed || undefined;
}
