import { buildAdvisorRootThemeCss } from "@/lib/theming/advisor-root-theme";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

/**
 * Injects advisor CSS variables on :root during SSR so intake/assessment content
 * (buttons, cards, page headers) is themed before BrandingProvider hydrates.
 */
export function ClientPortalRootTheme({
  branding,
}: {
  branding: AdvisorBrandingData;
}) {
  const css = buildAdvisorRootThemeCss(branding);
  if (!css) return null;

  return (
    <style
      id="client-portal-advisor-theme"
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
