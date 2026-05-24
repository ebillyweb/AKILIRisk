import { Page, Text, View } from "@react-pdf/renderer";
import { styles } from "../styles";
import { PageFooter } from "./PageFooter";
import { DraftWatermark } from "./DraftWatermark";

interface PillarNarrativeSectionProps {
  narratives: string[];
  riskLevel: string;
  companyName?: string;
  draft?: boolean;
}

export function PillarNarrativeSection({
  narratives,
  riskLevel,
  companyName,
  draft,
}: PillarNarrativeSectionProps) {
  if (narratives.length === 0) {
    return null;
  }

  const isPositive = riskLevel.toLowerCase() === "low";
  const header = isPositive ? "Pillar Summary" : "Pillar Assessment Summary";

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>{header}</Text>

      {narratives.map((text, index) => (
        <View key={index} style={styles.section}>
          <Text style={styles.paragraph}>{text}</Text>
        </View>
      ))}

      <PageFooter companyName={companyName} />
      {draft ? <DraftWatermark /> : null}
    </Page>
  );
}
