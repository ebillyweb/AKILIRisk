/** Notifies other browser tabs that the auth session cookie changed. */
export const AUTH_SESSION_SYNC_STORAGE_KEY = "akili-auth-ts";
export const AUTH_SESSION_SYNC_CHANNEL = "akili-auth-session";

/**
 * Whether a server-rendered shell should refresh to match the browser session.
 * Ignores transient `getSession()` nulls while the server still has a user id.
 */
export function shouldRefreshSessionShell(
  serverUserId: string,
  liveUserId: string | undefined,
): boolean {
  if (serverUserId && !liveUserId) return true;
  if (liveUserId && liveUserId !== serverUserId) return true;
  return false;
}

export function broadcastAuthSessionChange(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(AUTH_SESSION_SYNC_STORAGE_KEY, String(Date.now()));
  } catch {
    // Private browsing or blocked storage — BroadcastChannel may still work.
  }

  try {
    const channel = new BroadcastChannel(AUTH_SESSION_SYNC_CHANNEL);
    channel.postMessage({ type: "changed" });
    channel.close();
  } catch {
    // Unsupported — focus/visibility checks still reconcile stale tabs.
  }
}
