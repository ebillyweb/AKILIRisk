import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_SESSION_SYNC_STORAGE_KEY,
  broadcastAuthSessionChange,
  shouldRefreshSessionShell,
} from "@/lib/auth/session-sync";

describe("shouldRefreshSessionShell", () => {
  it("does not refresh when the browser session matches the server shell", () => {
    expect(shouldRefreshSessionShell("user-1", "user-1")).toBe(false);
  });

  it("does not refresh when both sessions are unauthenticated", () => {
    expect(shouldRefreshSessionShell("", undefined)).toBe(false);
  });

  it("refreshes when another tab signed out", () => {
    expect(shouldRefreshSessionShell("user-1", undefined)).toBe(true);
  });

  it("refreshes when another tab signed in as a different user", () => {
    expect(shouldRefreshSessionShell("user-1", "user-2")).toBe(true);
  });
});

describe("broadcastAuthSessionChange", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    vi.stubGlobal("BroadcastChannel", class {
      postMessage() {}
      close() {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes a timestamp so other tabs can detect session changes", () => {
    expect(storage.has(AUTH_SESSION_SYNC_STORAGE_KEY)).toBe(false);

    broadcastAuthSessionChange();

    const value = storage.get(AUTH_SESSION_SYNC_STORAGE_KEY);
    expect(value).toBeTruthy();
    expect(Number(value)).toBeGreaterThan(0);
  });
});
