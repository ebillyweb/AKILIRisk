import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { SupportForm } from "@/components/support/SupportForm";
import { redirect } from "next/navigation";

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildSignInHref({ callbackUrl: "/support" }));
  }

  const userRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      emailCiphertext: true,
    },
  });

  if (!userRow) {
    redirect(buildSignInHref({ callbackUrl: "/support" }));
  }

  const email =
    session.user.email?.trim() || decryptUserEmail(userRow.emailCiphertext);
  const defaultName =
    userRow.name?.trim() ||
    session.user.name?.trim() ||
    email.split("@")[0] ||
    "";

  return (
    <div className="mx-auto max-w-2xl">
      <SupportForm defaultName={defaultName} email={email} />
    </div>
  );
}
