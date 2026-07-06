import { getNotificationPreferencesAction, updateNotificationPreferencesAction } from "@/lib/actions/notification-actions";
import { NotificationPreferencesForm } from "@/components/advisor/NotificationPreferencesForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function NotificationSettingsPage() {
  const result = await getNotificationPreferencesAction();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/advisor/notifications" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Notifications
            </Link>
          </Button>
        </div>

        <div className="text-center py-12">
          <p className="text-destructive text-sm">
            Error loading notification preferences: {result.error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/advisor/notifications" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Notifications
          </Link>
        </Button>
      </div>

      <NotificationPreferencesForm
        preferences={result.data!}
        reminderPolicy={result.reminderPolicy}
        isEnterpriseMember={result.isEnterpriseMember}
        updatePreferencesAction={updateNotificationPreferencesAction}
      />
    </div>
  );
}