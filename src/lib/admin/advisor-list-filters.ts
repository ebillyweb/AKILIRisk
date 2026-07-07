export function isEnterpriseLinkedAdvisor(advisor: {
  advisorProfile?: { enterpriseId?: string | null } | null;
  enterpriseMembership?: { status?: string } | null;
}): boolean {
  return (
    Boolean(advisor.advisorProfile?.enterpriseId?.trim()) ||
    Boolean(advisor.enterpriseMembership)
  );
}
