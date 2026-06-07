import { Text, View } from "@react-pdf/renderer";

/**
 * Diagonal "DRAFT" overlay on preview PDFs (no PUBLISHED report yet).
 * Render after page content. One instance per Page — do not use `fixed`.
 */
export function DraftWatermark() {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          transform: "rotate(-35deg)",
          opacity: 0.1,
          fontSize: 72,
          fontWeight: "bold",
          color: "#64748b",
          textAlign: "center",
        }}
      >
        DRAFT
      </Text>
    </View>
  );
}
