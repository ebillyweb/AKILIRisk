import { Text, View } from "@react-pdf/renderer";

/**
 * §4.5 commit 3 (BRD §4.5): diagonal "DRAFT — NOT PUBLISHED" overlay
 * stamped on every page when a Report is rendered from live data
 * (DRAFT row OR the legacy route's no-PUBLISHED-yet preview path). The
 * watermark is rotated -30° to spread across most of an A4 page and
 * uses very light gray with low opacity so it doesn't obscure the
 * underlying content but makes it visually unmistakable that the PDF
 * isn't a published artifact.
 *
 * Render this AFTER all other page content so it sits on top in
 * @react-pdf/renderer's z-stack. Each Page that should be watermarked
 * needs its own <DraftWatermark /> sibling — the component does not
 * auto-apply across a Document.
 */
export function DraftWatermark() {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: 250,
        left: -50,
        right: -50,
        alignItems: "center",
        justifyContent: "center",
        transform: "rotate(-30deg)",
        opacity: 0.12,
      }}
    >
      <Text
        style={{
          fontSize: 90,
          fontWeight: "bold",
          color: "#0f172a",
          letterSpacing: 6,
        }}
      >
        DRAFT — NOT PUBLISHED
      </Text>
    </View>
  );
}
