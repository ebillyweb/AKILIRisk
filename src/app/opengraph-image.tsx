import { ImageResponse } from "next/og";

import { AKILI_BRAND, AKILI_TAGLINES } from "@/lib/brand/tokens";

export const alt = "AKILI Risk Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #1e293b 0%, #0f172a 55%, #172554 100%)",
          color: "#f8fafc",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#4EA5D9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0f172a",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            A
          </div>
          {AKILI_BRAND.shortName}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 920 }}>
          <div
            style={{
              fontSize: 58,
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
            }}
          >
            {AKILI_TAGLINES.platform}
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.45,
              color: "rgba(248, 250, 252, 0.82)",
              maxWidth: 880,
            }}
          >
            Structured assessments, prioritized risks, and actionable recommendations for
            professional firms and families.
          </div>
        </div>

        <div style={{ fontSize: 24, color: "rgba(248, 250, 252, 0.72)" }}>
          {AKILI_BRAND.website}
        </div>
      </div>
    ),
    { ...size },
  );
}
