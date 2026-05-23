import { redirect } from "next/navigation";

interface LegacyIdentityRedirectProps {
  params: Promise<{ questionIndex: string }>;
}

export default async function LegacyIdentityRedirect({ params }: LegacyIdentityRedirectProps) {
  const { questionIndex } = await params;
  redirect(`/assessment/governance/${questionIndex}`);
}
