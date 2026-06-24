import { after } from "next/server";

/**
 * Run async work after the HTTP response is sent without losing it on
 * Vercel/serverless (plain `void promise` is often frozen before it runs).
 */
export function scheduleAfterResponse(task: () => void | Promise<void>): void {
  after(task);
}
