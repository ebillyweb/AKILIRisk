import { describe, expect, it } from "vitest";
import { mergeFacilitatedLauncherClients } from "@/lib/facilitated/launcher-clients";
import type { FacilitatedSessionSummary } from "@/lib/facilitated/types";

function session(
  overrides: Partial<FacilitatedSessionSummary> & Pick<FacilitatedSessionSummary, "clientId">,
): FacilitatedSessionSummary {
  return {
    id: "sess-1",
    advisorProfileId: "adv-1",
    status: "ASSESSMENT",
    interviewId: null,
    assessmentId: "asm-1",
    startedAt: new Date("2026-06-24T13:31:05Z"),
    completedAt: null,
    clientName: "Test Client",
    clientEmail: "test@example.com",
    ...overrides,
  };
}

describe("mergeFacilitatedLauncherClients", () => {
  it("adds clients from open sessions that are not in the portfolio", () => {
    const merged = mergeFacilitatedLauncherClients(
      [],
      [session({ clientId: "client-1" })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "client-1",
      name: "Test Client",
      openSession: { id: "sess-1", status: "ASSESSMENT" },
    });
  });

  it("marks portfolio clients with an open session and sorts them first", () => {
    const merged = mergeFacilitatedLauncherClients(
      [
        { id: "b", name: "Bravo", email: "b@example.com" },
        { id: "a", name: "Alpha", email: "a@example.com" },
      ],
      [session({ clientId: "b", id: "sess-b" })],
    );
    expect(merged.map((c) => c.id)).toEqual(["b", "a"]);
    expect(merged[0].openSession).toEqual({ id: "sess-b", status: "ASSESSMENT" });
    expect(merged[1].openSession).toBeUndefined();
  });
});
