import type { NotificationType, SignalType } from "@prisma/client";
import type { RiskSeverity } from "@/lib/intelligence/types";

export const SIGNAL_FEED_WINDOW_DAYS = 90;
export const SCORE_DECLINE_THRESHOLD = 0.5;

export type AdvisorSignalPayload = {
  assessmentId?: string;
  reportId?: string;
  pillarId?: string;
  pillarName?: string;
  scoreBefore?: number;
  scoreAfter?: number;
  triggerCode?: string;
  assessmentVersion?: number;
  href: string;
};

export type RiskSignalFeedItem = {
  kind: "risk";
  id: string;
  advisorId: string;
  clientId: string;
  clientName: string;
  source: "INTERNAL_ASSESSMENT";
  type: SignalType;
  severity: RiskSeverity;
  title: string;
  message: string;
  payload: AdvisorSignalPayload;
  read: boolean;
  createdAt: Date;
};

export type WorkflowSignalFeedItem = {
  kind: "workflow";
  id: string;
  notificationType: NotificationType;
  severity: RiskSeverity;
  title: string;
  message: string;
  href: string;
  read: boolean;
  createdAt: Date;
};

export type SignalFeedItem = RiskSignalFeedItem | WorkflowSignalFeedItem;

export type SignalFeedSummary = {
  unreadCount: number;
  criticalCount: number;
  moderateCount: number;
  workflowCount: number;
  riskCount: number;
};

export type SignalFeedFilters = {
  severity?: RiskSeverity[];
  kinds?: Array<"risk" | "workflow">;
  unreadOnly?: boolean;
  limit?: number;
};

export const DEFAULT_SIGNAL_SEVERITY_FILTER: RiskSeverity[] = ["critical", "moderate"];

export type PillarScoreSnapshot = {
  pillar: string;
  score: number;
  riskLevel: string;
};
