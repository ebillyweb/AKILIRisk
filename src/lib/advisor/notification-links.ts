import type { AdvisorNotification } from "@prisma/client";

export function advisorNotificationHref(
  notification: Pick<AdvisorNotification, "type" | "referenceId">
): string {
  if (notification.type === "NEW_INTAKE" && notification.referenceId) {
    return `/advisor/review/${notification.referenceId}`;
  }
  if (notification.type === "NEW_LEAD" && notification.referenceId) {
    return `/advisor/leads/${notification.referenceId}`;
  }
  if (
    notification.type === "SYSTEM" &&
    notification.referenceId?.startsWith("enterprise-active:")
  ) {
    return "/advisor/billing";
  }
  return "/advisor/notifications";
}
