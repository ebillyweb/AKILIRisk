import { auth } from "@/lib/auth";
import { redirectPathUnlessClientRole } from "@/lib/client/require-client-role";
import { redirect } from "next/navigation";

/** Governance intake is client-only; advisors review at `/advisor/review/[id]`. */
export default async function IntakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) return <>{children}</>;

  const redirectTo = redirectPathUnlessClientRole(session.user.role);
  if (redirectTo) redirect(redirectTo);

  return <>{children}</>;
}
