import { describe, expect, it } from "vitest";
import {
  filterSyncPayloads,
  pillarsToLoadForSync,
} from "@/lib/assessment/sync-store-responses";

describe("pillarsToLoadForSync", () => {
  const catalog = [
    "governance",
    "cyber-digital",
    "liquidity-cash",
    "tax-exposure",
  ];

  it("loads only the current pillar when completing without explicit scope", () => {
    expect(
      pillarsToLoadForSync({
        currentPillar: "reputational-social",
        catalogSlugs: catalog,
      }),
    ).toEqual(["reputational-social"]);
  });

  it("unions current pillar with included scope", () => {
    expect(
      pillarsToLoadForSync({
        currentPillar: "governance",
        includedPillars: ["governance", "cyber-digital"],
        catalogSlugs: catalog,
      }).sort(),
    ).toEqual(["cyber-digital", "governance"]);
  });

  it("falls back to full catalog only when no current pillar or scope", () => {
    expect(
      pillarsToLoadForSync({
        currentPillar: null,
        catalogSlugs: catalog,
      }),
    ).toEqual(catalog);
  });
});

describe("filterSyncPayloads", () => {
  const payloads = [
    { questionId: "a", pillar: "governance" },
    { questionId: "b", pillar: "liquidity-cash" },
    { questionId: "c", pillar: "reputational-social" },
  ];

  it("keeps only the pillar being completed", () => {
    expect(
      filterSyncPayloads(payloads, { currentPillar: "reputational-social" }),
    ).toEqual([{ questionId: "c", pillar: "reputational-social" }]);
  });

  it("keeps only included scope when provided", () => {
    expect(
      filterSyncPayloads(payloads, {
        currentPillar: "liquidity-cash",
        includedPillars: ["governance", "reputational-social"],
      }),
    ).toEqual([
      { questionId: "a", pillar: "governance" },
      { questionId: "c", pillar: "reputational-social" },
    ]);
  });
});
