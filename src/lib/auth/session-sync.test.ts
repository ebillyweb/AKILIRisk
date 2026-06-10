import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_SESSION_SYNC_STORAGE_KEY,
  broadcastAuthSessionChange,
} from "@/lib/auth/session-sync";

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
