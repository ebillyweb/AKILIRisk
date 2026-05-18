import "server-only";

export interface PerformanceMetric {
  operation: string;
  durationMs: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Performance thresholds (in milliseconds)
export const PERFORMANCE_THRESHOLDS = {
  FAST: 100,
  WARNING: 1000,
  SLOW: 3000,
  CRITICAL: 10000,
} as const;

export type PerformanceLevel = keyof typeof PERFORMANCE_THRESHOLDS;

/**
 * Get performance level based on duration.
 */
export function getPerformanceLevel(durationMs: number): PerformanceLevel {
  if (durationMs <= PERFORMANCE_THRESHOLDS.FAST) return "FAST";
  if (durationMs <= PERFORMANCE_THRESHOLDS.WARNING) return "WARNING";
  if (durationMs <= PERFORMANCE_THRESHOLDS.SLOW) return "SLOW";
  return "CRITICAL";
}

/**
 * Simple performance monitoring utility.
 * Measures execution time and logs slow operations.
 */
export class PerformanceMonitor {
  private startTime: number;
  private operation: string;
  private metadata: Record<string, unknown>;

  constructor(operation: string, metadata: Record<string, unknown> = {}) {
    this.operation = operation;
    this.metadata = metadata;
    this.startTime = performance.now();
  }

  /**
   * End measurement and return performance metric.
   */
  end(): PerformanceMetric {
    const durationMs = performance.now() - this.startTime;
    const level = getPerformanceLevel(durationMs);

    const metric: PerformanceMetric = {
      operation: this.operation,
      durationMs: Math.round(durationMs * 100) / 100, // Round to 2 decimal places
      timestamp: new Date().toISOString(),
      metadata: {
        ...this.metadata,
        level,
      },
    };

    // Log slow operations
    if (level === "SLOW" || level === "CRITICAL") {
      console.warn(`Slow operation detected: ${this.operation}`, {
        durationMs: metric.durationMs,
        level,
        ...this.metadata,
      });
    }

    // Log critical operations
    if (level === "CRITICAL") {
      console.error(`Critical performance issue: ${this.operation}`, {
        durationMs: metric.durationMs,
        level,
        ...this.metadata,
      });
    }

    return metric;
  }
}

// Skip monitoring for operations that are too frequent or trivial
const MONITORING_SKIP_PATTERNS = [
  /^cache-/,
  /^validation-/
];

const MONITORING_SAMPLE_RATE = 0.1; // Monitor 10% of cache operations

/**
 * Higher-order function to monitor async operations.
 */
export async function monitorPerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata: Record<string, unknown> = {}
): Promise<{ result: T; metric: PerformanceMetric }> {
  // Skip monitoring for high-frequency operations
  const shouldSkip = MONITORING_SKIP_PATTERNS.some(pattern => pattern.test(operation));
  if (shouldSkip && Math.random() > MONITORING_SAMPLE_RATE) {
    const result = await fn();
    // Return minimal metric without actual timing
    return {
      result,
      metric: {
        operation,
        durationMs: 0,
        timestamp: new Date().toISOString(),
        metadata: { ...metadata, sampled: false }
      }
    };
  }

  const monitor = new PerformanceMonitor(operation, metadata);

  try {
    const result = await fn();
    const metric = monitor.end();
    return { result, metric };
  } catch (error) {
    const metric = monitor.end();
    console.error(`Operation failed: ${operation}`, {
      durationMs: metric.durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
      ...metadata,
    });
    throw error;
  }
}

/**
 * Monitor sync operations.
 */
export function monitorSyncPerformance<T>(
  operation: string,
  fn: () => T,
  metadata: Record<string, unknown> = {}
): { result: T; metric: PerformanceMetric } {
  const monitor = new PerformanceMonitor(operation, metadata);

  try {
    const result = fn();
    const metric = monitor.end();
    return { result, metric };
  } catch (error) {
    const metric = monitor.end();
    console.error(`Sync operation failed: ${operation}`, {
      durationMs: metric.durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
      ...metadata,
    });
    throw error;
  }
}

/**
 * Simple timing utility for quick measurements.
 */
export function measureTime<T>(fn: () => T): { result: T; durationMs: number } {
  const start = performance.now();
  const result = fn();
  const durationMs = performance.now() - start;
  return { result, durationMs: Math.round(durationMs * 100) / 100 };
}

/**
 * Async timing utility.
 */
export async function measureTimeAsync<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs: Math.round(durationMs * 100) / 100 };
}