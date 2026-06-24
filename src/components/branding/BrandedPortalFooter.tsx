import { Mail, Phone, Globe } from "lucide-react";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";

export function BrandedPortalFooter({ branding }: { branding: AdvisorBrandingData }) {
  const brandTitle = clientPortalBrandingDisplayTitle(branding);
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6 text-center text-sm text-muted-foreground">
      {(branding.supportEmail || branding.supportPhone || branding.websiteUrl) && (
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {branding.supportEmail ? (
            <a
              href={`mailto:${branding.supportEmail}`}
              className="inline-flex items-center gap-2 font-medium text-foreground hover:underline"
            >
              <Mail className="size-4" aria-hidden />
              {branding.supportEmail}
            </a>
          ) : null}
          {branding.supportPhone ? (
            <a
              href={`tel:${branding.supportPhone}`}
              className="inline-flex items-center gap-2 font-medium text-foreground hover:underline"
            >
              <Phone className="size-4" aria-hidden />
              {branding.supportPhone}
            </a>
          ) : null}
          {branding.websiteUrl ? (
            <a
              href={branding.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-medium text-foreground hover:underline"
            >
              <Globe className="size-4" aria-hidden />
              Visit website
            </a>
          ) : null}
        </div>
      )}

      <div className="space-y-1">
        <p>{branding.emailFooterText || `© ${year} ${brandTitle}. All rights reserved.`}</p>
        <p className="text-xs">Powered by AkiliRisk Platform</p>
      </div>
    </div>
  );
}
