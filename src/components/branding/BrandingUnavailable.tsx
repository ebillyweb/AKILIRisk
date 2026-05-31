type BrandingUnavailableProps = {
  /** Client-facing portal vs advisor-facing setup message */
  audience?: "client" | "advisor";
  title?: string;
  message?: string;
};

const CLIENT_DEFAULT = {
  title: "Portal not available",
  message:
    "This advisor portal is not fully configured yet. Please contact your advisor or try again later.",
};

const ADVISOR_DEFAULT = {
  title: "Branding not available",
  message:
    "Your white-label portal is not fully configured. Finish subdomain and branding setup in Settings, then try again.",
};

/**
 * Fail-closed UI when a branded experience was expected but branding cannot load.
 */
export function BrandingUnavailable({
  audience = "client",
  title,
  message,
}: BrandingUnavailableProps) {
  const copy = audience === "advisor" ? ADVISOR_DEFAULT : CLIENT_DEFAULT;

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6 py-12">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          {title ?? copy.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {message ?? copy.message}
        </p>
      </div>
    </div>
  );
}
