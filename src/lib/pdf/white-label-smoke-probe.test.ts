import { describe, expect, it } from "vitest";
import {
  runWhiteLabelPdfSmokeProbe,
  SMOKE_PDF_FIRM_NAME,
  SMOKE_PDF_BRANDING,
} from "./white-label-smoke-probe";

describe("runWhiteLabelPdfSmokeProbe", () => {
  it("embeds white-label firm name in the rendered PDF", async () => {
    const result = await runWhiteLabelPdfSmokeProbe();

    expect(result.byteLength).toBeGreaterThan(1000);
    expect(Buffer.from(result.bytes).subarray(0, 4).toString()).toBe("%PDF");
    expect(result.firmName).toBe(SMOKE_PDF_FIRM_NAME);
    expect(result.firmNameEmbedded).toBe(true);
    expect(result.usesWhiteLabelFirm).toBe(true);
    expect(result.filenameSlugFirm).toBe("smoke-wl-pdf-partners-llc");
    expect(Buffer.from(result.bytes).toString("latin1")).toContain(
      SMOKE_PDF_FIRM_NAME,
    );
  }, 30_000);

  it("falls back to Akili Risk when branding is null", async () => {
    const result = await runWhiteLabelPdfSmokeProbe({ branding: null });

    expect(result.firmName).toBe("Akili Risk");
    expect(result.firmNameEmbedded).toBe(true);
    expect(result.usesWhiteLabelFirm).toBe(false);
    expect(result.filenameSlugFirm).toBe("akili-risk");
    expect(Buffer.from(result.bytes).toString("latin1")).toContain("Akili Risk");
    expect(Buffer.from(result.bytes).toString("latin1")).not.toContain(
      SMOKE_PDF_FIRM_NAME,
    );
  }, 30_000);

  it("prefers advisorFirmName over brandName (portal / PDF display rule)", async () => {
    const result = await runWhiteLabelPdfSmokeProbe({
      branding: {
        ...SMOKE_PDF_BRANDING,
        brandName: "Stale Brand Name Seed",
        advisorFirmName: "Live Firm Name From Profile",
      },
    });

    const text = Buffer.from(result.bytes).toString("latin1");
    expect(result.firmName).toBe("Live Firm Name From Profile");
    expect(result.firmNameEmbedded).toBe(true);
    expect(result.filenameSlugFirm).toBe("live-firm-name-from-profile");
    expect(text).toContain("Live Firm Name From Profile");
    expect(text).not.toContain("Stale Brand Name Seed");
  }, 30_000);
});
