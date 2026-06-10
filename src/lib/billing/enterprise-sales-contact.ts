/** Mailto target for solo advisors who want Enterprise (sales-assisted only). */
export function getEnterpriseSalesContactEmail(): string {
  return process.env.ENTERPRISE_SALES_EMAIL?.trim() || "sales@akilirisk.com";
}

export function getEnterpriseSalesMailtoHref(): string {
  const email = getEnterpriseSalesContactEmail();
  const subject = encodeURIComponent("AkiliRisk Enterprise plan inquiry");
  return `mailto:${email}?subject=${subject}`;
}
