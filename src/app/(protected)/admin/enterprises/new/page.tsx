import { AdminCreateEnterpriseForm } from "@/components/admin/AdminCreateEnterpriseForm";
import { getAdvisorsEligibleForEnterpriseOwner } from "@/lib/admin/queries";

export default async function AdminNewEnterprisePage() {
  const owners = await getAdvisorsEligibleForEnterpriseOwner();

  return (
    <AdminCreateEnterpriseForm
      owners={owners
        .filter((owner): owner is typeof owner & { email: string } => owner.email != null)
        .map((owner) => ({
          id: owner.id,
          email: owner.email,
          name: owner.name,
          advisorProfile: owner.advisorProfile,
        }))}
    />
  );
}
