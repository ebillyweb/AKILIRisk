import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";

import { getConfiguredSocialProfiles, type SocialProfileId } from "@/lib/marketing/social-profiles";
import { cn } from "@/lib/utils";

const SOCIAL_ICONS: Record<SocialProfileId, typeof Linkedin> = {
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  x: XIcon,
  youtube: Youtube,
};

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M17.687 3H20.5l-7.5 8.573L21.5 21h-6.063l-4.75-5.573L5.25 21H2.437l8.063-9.218L2.5 3h6.188l4.312 5.032L17.687 3Zm-1.063 16.2h1.688L8.5 4.726H6.688l10.936 14.474Z" />
    </svg>
  );
}

type SiteSocialLinksProps = {
  className?: string;
  iconClassName?: string;
};

export function SiteSocialLinks({ className, iconClassName }: SiteSocialLinksProps) {
  const profiles = getConfiguredSocialProfiles();
  if (profiles.length === 0) return null;

  return (
    <nav aria-label="Social media" className={cn("flex flex-wrap items-center gap-3", className)}>
      {profiles.map(({ id, label, href }) => {
        const Icon = SOCIAL_ICONS[id];
        return (
          <a
            key={id}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md text-foreground/90 underline-offset-4 transition-colors duration-200 hover:text-foreground hover:underline"
          >
            <Icon className={cn("size-4 shrink-0", iconClassName)} aria-hidden />
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
