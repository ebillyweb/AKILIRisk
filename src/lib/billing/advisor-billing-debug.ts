/**
 * Gates `/advisor/billing` debug logs (`[advisor-billing]`).
 * - `NEXT_PUBLIC_DEBUG_ADVISOR_BILLING=1` → on in any NODE_ENV
 * - `NEXT_PUBLIC_DEBUG_ADVISOR_BILLING=0` → off even in development
 * - unset → on only when `NODE_ENV === "development"`
 */
export function isAdvisorBillingDebugEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_DEBUG_ADVISOR_BILLING;
  if (flag === "0") return false;
  if (flag === "1") return true;
  return process.env.NODE_ENV === "development";
}
