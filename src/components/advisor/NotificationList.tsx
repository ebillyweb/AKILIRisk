"use client";

import { createElement } from "react";
import { Bell, RefreshCw, Info } from "lucide-react";
import { formatDistanceToNow, isToday, isThisWeek } from "date-fns";
import { useRouter } from "next/navigation";
import { markNotificationReadAction } from "@/lib/actions/advisor-actions";
import { advisorNotificationHref } from "@/lib/advisor/notification-links";
import type { AdvisorNotification } from "@prisma/client";
import { cn } from "@/lib/utils";

interface NotificationListProps {
  notifications: AdvisorNotification[];
}

function getNotificationIcon(type: AdvisorNotification["type"]) {
  switch (type) {
    case "NEW_INTAKE":
      return Bell;
    case "INTAKE_UPDATED":
      return RefreshCw;
    case "SYSTEM":
      return Info;
    default:
      return Bell;
  }
}

function formatNotificationTime(date: Date) {
  return formatDistanceToNow(date, { addSuffix: true });
}

function groupNotificationsByDate(notifications: AdvisorNotification[]) {
  const today: AdvisorNotification[] = [];
  const thisWeek: AdvisorNotification[] = [];
  const older: AdvisorNotification[] = [];

  notifications.forEach((notification) => {
    const date = new Date(notification.createdAt);
    if (isToday(date)) {
      today.push(notification);
    } else if (isThisWeek(date)) {
      thisWeek.push(notification);
    } else {
      older.push(notification);
    }
  });

  const byNewest = (a: AdvisorNotification, b: AdvisorNotification) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  today.sort(byNewest);
  thisWeek.sort(byNewest);
  older.sort(byNewest);

  return { today, thisWeek, older };
}

function NotificationItem({
  notification,
  onActivate,
}: {
  notification: AdvisorNotification;
  onActivate: (n: AdvisorNotification) => void;
}) {
  const unread = !notification.read;

  return (
    <button
      type="button"
      onClick={() => onActivate(notification)}
      className={cn(
        "group relative flex w-full gap-4 rounded-xl border p-4 text-left transition-[background-color,box-shadow,border-color] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        unread
          ? "border-primary/30 bg-primary/[0.06] shadow-sm hover:bg-primary/[0.09] dark:border-primary/40 dark:bg-primary/10 dark:hover:bg-primary/[0.14]"
          : "border-border/70 bg-card hover:border-border hover:bg-muted/35",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-4 bottom-4 w-1 rounded-full transition-colors",
          unread ? "bg-primary" : "bg-transparent",
        )}
        aria-hidden
      />

      <div
        className={cn(
          "ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors",
          unread
            ? "border-primary/20 bg-primary/10 text-primary"
            : "border-border/60 bg-muted/50 text-muted-foreground group-hover:bg-muted",
        )}
      >
        {createElement(getNotificationIcon(notification.type), {
          className: "h-5 w-5",
          "aria-hidden": true,
        })}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <p
          className={cn(
            "text-sm leading-snug text-foreground",
            unread ? "font-semibold" : "font-medium",
          )}
        >
          {notification.title}
          {unread ? (
            <span className="sr-only"> — unread</span>
          ) : null}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {notification.message}
        </p>
        <p className="mt-2 text-xs tabular-nums text-muted-foreground/90">
          <time dateTime={new Date(notification.createdAt).toISOString()}>
            {formatNotificationTime(new Date(notification.createdAt))}
          </time>
        </p>
      </div>
    </button>
  );
}

function SectionBlock({
  sectionId,
  title,
  description,
  notifications,
  onActivate,
}: {
  sectionId: string;
  title: string;
  description?: string;
  notifications: AdvisorNotification[];
  onActivate: (n: AdvisorNotification) => void;
}) {
  if (notifications.length === 0) return null;

  const headingId = `notif-section-${sectionId}`;

  return (
    <section className="space-y-3" aria-labelledby={headingId}>
      <div className="flex flex-col gap-0.5 border-b border-border/50 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 id={headingId} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-[11px] text-muted-foreground/80 sm:text-right">{description}</p>
        ) : null}
      </div>
      <ul className="mx-auto max-w-3xl space-y-2.5" role="list">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <NotificationItem notification={notification} onActivate={onActivate} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NotificationList({ notifications }: NotificationListProps) {
  const router = useRouter();

  const handleNotificationClick = async (notification: AdvisorNotification) => {
    if (!notification.read) {
      try {
        await markNotificationReadAction(notification.id);
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }

    const href = advisorNotificationHref(notification);
    if (href !== "/advisor/notifications") {
      router.push(href);
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Bell className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
        <p className="mt-5 text-sm font-medium text-foreground">No notifications yet</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          When clients complete intake or assessments, updates will show up here.
        </p>
      </div>
    );
  }

  const { today, thisWeek, older } = groupNotificationsByDate(notifications);

  return (
    <div className="space-y-10">
      <SectionBlock
        sectionId="today"
        title="Today"
        notifications={today}
        onActivate={handleNotificationClick}
      />
      <SectionBlock
        sectionId="this-week"
        title="Earlier this week"
        notifications={thisWeek}
        onActivate={handleNotificationClick}
      />
      <SectionBlock
        sectionId="older"
        title="Older"
        description="May include unread items — open to mark as read."
        notifications={older}
        onActivate={handleNotificationClick}
      />
    </div>
  );
}
