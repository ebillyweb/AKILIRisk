import type { ActivityType } from "@/components/admin/dashboard/RecentActivityItem";
import type { AlertSeverity } from "@/components/admin/dashboard/NeedsAttentionItem";
import type { MetricStatus } from "@/components/admin/dashboard/MetricCard";

export type MetricTrend = {
  value: string;
  direction: "up" | "down" | "flat";
};

export interface ControlCenterMetrics {
  activeAdvisors: { value: number; trend: MetricTrend };
  assessmentsInProgress: { value: number; trend: MetricTrend };
  intakeCompletionRate: { value: string; trend: MetricTrend };
  platformStatus: { value: string; status: MetricStatus };
  failedIntegrations: { value: number; status: MetricStatus };
  pendingReviews: { value: number; trend: MetricTrend };
}

export type ControlCenterAlertIconKey =
  | "clock"
  | "puzzle"
  | "userPlus"
  | "clipboardList"
  | "alertTriangle";

export interface ControlCenterAlert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  iconKey: ControlCenterAlertIconKey;
  href: string;
  timestamp: string;
}

export type ControlCenterActivityIconKey =
  | "checkCircle"
  | "userPlus"
  | "clipboardList"
  | "alertTriangle"
  | "fileText"
  | "activity";

export interface ControlCenterActivity {
  id: string;
  type: ActivityType;
  iconKey: ControlCenterActivityIconKey;
  title: string;
  description: string;
  timestamp: string;
  user?: string;
}

export interface ControlCenterSnapshot {
  generatedAt: string;
  metrics: ControlCenterMetrics | null;
  alerts: ControlCenterAlert[] | null;
  activity: ControlCenterActivity[] | null;
}
