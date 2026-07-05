import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPlatformAdminRole, normalizeUserRoleString } from "@/lib/auth-roles";
import { getClientDocumentRequirements } from "@/lib/actions/document-actions";
import { isClientDocumentRequirementsEnabledForUser } from "@/lib/client/client-document-requirements-visibility.server";
import { ClientDocumentPortal } from "@/components/documents/ClientDocumentPortal";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildSignInHref({ callbackUrl: "/documents" }));
  }

  const role = normalizeUserRoleString(session.user.role);
  if (role === "ADVISOR") {
    redirect("/advisor");
  }
  if (isPlatformAdminRole(role)) {
    redirect("/admin");
  }

  const documentRequirementsEnabled =
    await isClientDocumentRequirementsEnabledForUser(session.user.id);
  if (!documentRequirementsEnabled) {
    redirect("/dashboard");
  }

  const result = await getClientDocumentRequirements();

  if (!result.success) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-destructive mb-2">
          Error Loading Documents
        </h2>
        <p className="text-muted-foreground">
          {result.error}
        </p>
      </div>
    );
  }

  const advisorGroups = result.data || [];

  // If no requirements from any advisor, show empty state
  if (advisorGroups.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-4">No Document Requirements</h2>
        <p className="text-muted-foreground">
          No document requirements yet. Your advisor will request documents when needed.
        </p>
      </div>
    );
  }

  // For now, display requirements from the first advisor
  // In the future, this could be enhanced to handle multiple advisors
  const firstGroup = advisorGroups[0];
  const rawLogo = firstGroup.advisor.logoUrl?.trim();
  const fallbackLogoSrc =
    rawLogo && (rawLogo.startsWith("https://") || rawLogo.startsWith("/"))
      ? rawLogo
      : null;

  const advisorInfo = {
    firmName: firstGroup.advisor.firmName,
    logoSrc: fallbackLogoSrc,
  };

  return (
    <ClientDocumentPortal
      requirements={firstGroup.requirements}
      advisorInfo={advisorInfo}
    />
  );
}