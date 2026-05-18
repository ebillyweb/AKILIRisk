import { z } from "zod";

// Metric status schema
export const MetricStatusSchema = z.enum(["healthy", "warning", "critical", "neutral"]);

// Trend schema
export const TrendSchema = z.object({
  value: z.string(),
  direction: z.enum(["up", "down", "flat"]),
}).optional();

// Individual metric schemas
export const MetricValueSchema = z.object({
  value: z.union([z.string(), z.number()]),
  trend: TrendSchema,
  status: MetricStatusSchema.optional(),
});

// Control center metrics schema
export const ControlCenterMetricsSchema = z.object({
  activeAdvisors: MetricValueSchema,
  assessmentsInProgress: MetricValueSchema,
  intakeCompletionRate: MetricValueSchema,
  platformStatus: MetricValueSchema,
  failedIntegrations: MetricValueSchema,
  pendingReviews: MetricValueSchema,
});

// Alert severity schema
export const AlertSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

// Alert icon schema
export const AlertIconKeySchema = z.enum([
  "clock",
  "puzzle",
  "userPlus",
  "clipboardList",
  "alertTriangle"
]);

// Control center alert schema
export const ControlCenterAlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: AlertSeveritySchema,
  iconKey: AlertIconKeySchema,
  href: z.string(),
  timestamp: z.string(),
});

// Activity type schema
export const ActivityTypeSchema = z.enum([
  "assessment",
  "advisor",
  "intake",
  "integration",
  "report",
  "system"
]);

// Activity icon schema
export const ActivityIconKeySchema = z.enum([
  "checkCircle",
  "userPlus",
  "clipboardList",
  "alertTriangle",
  "fileText",
  "activity"
]);

// Control center activity schema
export const ControlCenterActivitySchema = z.object({
  id: z.string(),
  type: ActivityTypeSchema,
  iconKey: ActivityIconKeySchema,
  title: z.string(),
  description: z.string(),
  timestamp: z.string(),
  user: z.string(),
});

// Full control center snapshot schema
export const ControlCenterSnapshotSchema = z.object({
  generatedAt: z.string(),
  metrics: ControlCenterMetricsSchema.nullable(),
  alerts: z.array(ControlCenterAlertSchema).nullable(),
  activity: z.array(ControlCenterActivitySchema).nullable(),
});

// Validation helper functions
export function validateControlCenterSnapshot(data: unknown):
  { success: true; data: z.infer<typeof ControlCenterSnapshotSchema> } |
  { success: false; error: string } {
  try {
    const parsed = ControlCenterSnapshotSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: `Validation failed at ${firstError.path.join('.')}: ${firstError.message}`
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
}

export function validateControlCenterMetrics(data: unknown):
  { success: true; data: z.infer<typeof ControlCenterMetricsSchema> } |
  { success: false; error: string } {
  try {
    const parsed = ControlCenterMetricsSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: `Metrics validation failed at ${firstError.path.join('.')}: ${firstError.message}`
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
}

export function validateControlCenterAlerts(data: unknown):
  { success: true; data: z.infer<typeof ControlCenterAlertSchema>[] } |
  { success: false; error: string } {
  try {
    const parsed = z.array(ControlCenterAlertSchema).parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: `Alerts validation failed at ${firstError.path.join('.')}: ${firstError.message}`
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
}

// Type exports
export type ControlCenterSnapshot = z.infer<typeof ControlCenterSnapshotSchema>;
export type ControlCenterMetrics = z.infer<typeof ControlCenterMetricsSchema>;
export type ControlCenterAlert = z.infer<typeof ControlCenterAlertSchema>;
export type ControlCenterActivity = z.infer<typeof ControlCenterActivitySchema>;
export type MetricStatus = z.infer<typeof MetricStatusSchema>;
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;
export type ActivityType = z.infer<typeof ActivityTypeSchema>;