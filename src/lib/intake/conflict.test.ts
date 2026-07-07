import { describe, it, expect } from "vitest";
import { isStaleWrite } from "./conflict";

describe("isStaleWrite (intake conflict rule)", () => {
  it("discards a write older than the server value", () => {
    const server = new Date("2026-06-14T12:00:00Z");
    expect(isStaleWrite(server, "2026-06-14T11:59:59Z")).toBe(true);
  });

  it("applies a write newer than the server value", () => {
    const server = new Date("2026-06-14T12:00:00Z");
    expect(isStaleWrite(server, "2026-06-14T12:00:01Z")).toBe(false);
  });

  it("applies a write equal to the server value (not strictly newer)", () => {
    const ts = "2026-06-14T12:00:00.000Z";
    expect(isStaleWrite(new Date(ts), ts)).toBe(false);
  });

  it("applies the write when there is no existing record", () => {
    expect(isStaleWrite(null, "2026-06-14T12:00:00Z")).toBe(false);
    expect(isStaleWrite(undefined, "2026-06-14T12:00:00Z")).toBe(false);
  });

  it("applies the write when the incoming timestamp is missing or invalid", () => {
    const server = new Date("2026-06-14T12:00:00Z");
    expect(isStaleWrite(server, undefined)).toBe(false);
    expect(isStaleWrite(server, "not-a-date")).toBe(false);
  });
});
