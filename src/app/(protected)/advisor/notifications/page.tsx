import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationList } from "@/components/advisor/NotificationList";
import {
  getAdvisorNotificationsAction,
  markAllNotificationsReadAction,
} from "@/lib/actions/advisor-actions";
import { redirect } from "next/navigation";

async function MarkAllReadButton({ hasUnread }: { hasUnread: boolean }) {
  async function markAllRead() {
    "use server";
    await markAllNotificationsReadAction();
  }

  if (!hasUnread) {
    return null;
  }

  return (
    <form action={markAllRead}>
      <Button type="submit" variant="outline" size="sm" className="min-h-9 shrink-0">
        Mark all as read
      </Button>
    </form>
  );
}

export default async function NotificationsPage() {
  const result = await getAdvisorNotificationsAction();

  if (!result.success) {
    redirect("/advisor");
  }

  const notifications = result.data || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <MarkAllReadButton hasUnread={unreadCount > 0} />
        <Button variant="outline" size="icon" asChild className="h-9 w-9 shrink-0">
          <Link href="/advisor/settings/notifications" aria-label="Notification settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <NotificationList notifications={notifications} />
    </div>
  );
}
