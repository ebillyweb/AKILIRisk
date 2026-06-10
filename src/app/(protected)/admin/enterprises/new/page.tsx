import { AdminCreateEnterpriseForm } from "@/components/admin/AdminCreateEnterpriseForm";
import { getAdvisorsEligibleForEnterpriseOwner } from "@/lib/admin/queries";

export default async function AdminNewEnterprisePage() {
  const owners = await getAdvisorsEligibleForEnterpriseOwner();

  return (
    <AdminCreateEnterpriseForm
      owners={owners.map((owner) => ({
        id: owner.id,
        email: owner.email,
        name: owner.name,
        advisorProfile: owner.advisorProfile,
      }))}
    />
  );
}
