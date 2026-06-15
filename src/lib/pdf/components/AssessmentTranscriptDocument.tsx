import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import {
  createBrandedPDFMetadata,
  pdfDisplayNameFromBranding,
} from "@/lib/pdf/branding-integration";
import type { AssessmentPdfData } from "@/lib/pdf/assessment/build-assessment-pdf-data";
import { PageFooter } from "./PageFooter";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 56,
    paddingBottom: 72,
    paddingHorizontal: 56,
    lineHeight: 1.45,
    color: "#374151",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 20,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1 solid #e5e7eb",
  },
  metaItem: {
    width: "50%",
    marginBottom: 10,
    paddingRight: 12,
  },
  metaLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#9ca3af",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    color: "#111827",
  },
  questionBlock: {
    marginBottom: 18,
    paddingBottom: 14,
    borderBottom: "1 solid #f3f4f6",
  },
  questionKicker: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#9ca3af",
    marginBottom: 4,
  },
  questionText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 8,
    lineHeight: 1.35,
  },
  answerText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.5,
    backgroundColor: "#f9fafb",
    padding: 10,
    borderRadius: 4,
  },
  advisorNote: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeft: "2 solid #d1d5db",
  },
  advisorNoteLabel: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 2,
  },
  advisorNoteText: {
    fontSize: 9,
    color: "#4b5563",
    fontStyle: "italic",
    lineHeight: 1.4,
  },
});

export interface AssessmentTranscriptDocumentProps {
  data: AssessmentPdfData;
  branding?: AdvisorBrandingData | null;
}

export function AssessmentTranscriptDocument({
  data,
  branding,
}: AssessmentTranscriptDocumentProps) {
  const firmName = pdfDisplayNameFromBranding(branding ?? undefined);
  const metadata = createBrandedPDFMetadata(branding ?? undefined);
  metadata.title = "Risk Assessment Transcript";
  metadata.subject = "Client assessment questions and responses";

  return (
    <Document
      title={metadata.title}
      author={metadata.author}
      creator={metadata.creator}
      producer={metadata.producer}
      subject={metadata.subject}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Risk Assessment Transcript</Text>
        <Text style={styles.subtitle}>
          Questions and client responses from the completed risk assessment.
        </Text>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Client</Text>
            <Text style={styles.metaValue}>{data.clientName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Email</Text>
            <Text style={styles.metaValue}>{data.clientEmail}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Completed</Text>
            <Text style={styles.metaValue}>
              {data.completedAt ?? "Not completed"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Assessment</Text>
            <Text style={styles.metaValue}>
              v{data.version} · {data.responseCount} responses
            </Text>
          </View>
        </View>

        {data.responses.map((response) => (
          <View key={`response-${response.index}`} style={styles.questionBlock}>
            <Text style={styles.questionKicker}>
              Response {response.index} of {data.responseCount} ·{" "}
              {response.pillarLabel} · {response.subCategoryLabel}
            </Text>
            <Text style={styles.questionText}>{response.questionText}</Text>
            <Text style={styles.answerText}>{response.answerText}</Text>
            {response.advisorNote ? (
              <View style={styles.advisorNote}>
                <Text style={styles.advisorNoteLabel}>Advisor note</Text>
                <Text style={styles.advisorNoteText}>
                  {response.advisorNote}
                </Text>
              </View>
            ) : null}
          </View>
        ))}

        <PageFooter companyName={firmName} />
      </Page>
    </Document>
  );
}
