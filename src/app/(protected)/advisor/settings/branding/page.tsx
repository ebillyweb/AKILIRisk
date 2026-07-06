import { notFound } from "next/navigation";

import { AdvisorBrandingPanel } from "@/components/advisor/settings/AdvisorBrandingPanel";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { loadAdvisorBrandingPageData } from "@/lib/advisor/branding-settings-page";

export default async function AdvisorBrandingSettingsPage() {
  const { userId } = await requireAdvisorRole();
  const loaded = await loadAdvisorBrandingPageData(userId);

  if (!loaded.success) {
    if ("notFound" in loaded && loaded.notFound) {
      notFound();
    }
    const errorMessage =
      "error" in loaded ? loaded.error : "Failed to load brand settings.";
    return (
      <div className="space-y-6">
        <div className="py-12 text-center">
          <p className="text-destructive text-sm">
            Error loading brand settings: {errorMessage}
          </p>
        </div>
      </div>
    );
  }

  return <AdvisorBrandingPanel data={loaded.data} />;
}
