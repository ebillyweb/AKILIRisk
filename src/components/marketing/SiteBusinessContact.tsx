import { MapPin, Phone } from "lucide-react";

import {
  formatBusinessAddressLines,
  formatPhoneTelHref,
  getBusinessAddress,
  getBusinessPhone,
} from "@/lib/marketing/business-contact";
import { cn } from "@/lib/utils";

type SiteBusinessContactProps = {
  className?: string;
  /** Larger spacing and typography for the contact page sidebar. */
  variant?: "footer" | "contact";
};

export function SiteBusinessContact({
  className,
  variant = "footer",
}: SiteBusinessContactProps) {
  const phone = getBusinessPhone();
  const address = getBusinessAddress();

  if (!phone && !address) return null;

  const isContact = variant === "contact";

  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-6 text-muted-foreground",
        isContact && "rounded-xl border border-border/70 bg-card/70 p-5 text-foreground/90",
        className,
      )}
    >
      {isContact ? <p className="editorial-kicker text-foreground">Office</p> : null}

      {phone ? (
        <p className="flex items-start gap-2.5">
          <Phone className="mt-0.5 size-4 shrink-0 text-foreground/70" aria-hidden />
          <a
            href={formatPhoneTelHref(phone)}
            className="font-medium text-foreground/90 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {phone}
          </a>
        </p>
      ) : null}

      {address ? (
        <address className="flex items-start gap-2.5 not-italic">
          <MapPin className="mt-0.5 size-4 shrink-0 text-foreground/70" aria-hidden />
          <span className="space-y-0.5">
            {formatBusinessAddressLines(address).map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
        </address>
      ) : null}
    </div>
  );
}
