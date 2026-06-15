import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import {
  createBrandedPDFMetadata,
  pdfDisplayNameFromBranding,
} from "@/lib/pdf/branding-integration";
import type { IntakePdfData } from "@/lib/pdf/intake/build-intake-pdf-data";
import { PageFooter } from "./PageFooter";

const intakeStyles = StyleSheet.create({
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
  answerLabel: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 4,
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

export interface IntakeTranscriptDocumentProps {
  data: IntakePdfData;
  branding?: AdvisorBrandingData | null;
}

export function IntakeTranscriptDocument({
  data,
  branding,
}: IntakeTranscriptDocumentProps) {
  const firmName = pdfDisplayNameFromBranding(branding ?? undefined);
  const metadata = createBrandedPDFMetadata(branding ?? undefined);
  metadata.title = "Intake Interview Transcript";
  metadata.subject = "Client intake questions and responses";

  return (
    <Document
      title={metadata.title}
      author={metadata.author}
      creator={metadata.creator}
      producer={metadata.producer}
      subject={metadata.subject}
    >
      <Page size="A4" style={intakeStyles.page}>
        <Text style={intakeStyles.title}>Intake Interview Transcript</Text>
        <Text style={intakeStyles.subtitle}>
          Questions and client responses from the governance intake interview.
        </Text>

        <View style={intakeStyles.metaGrid}>
          <View style={intakeStyles.metaItem}>
            <Text style={intakeStyles.metaLabel}>Client</Text>
            <Text style={intakeStyles.metaValue}>{data.clientName}</Text>
          </View>
          <View style={intakeStyles.metaItem}>
            <Text style={intakeStyles.metaLabel}>Email</Text>
            <Text style={intakeStyles.metaValue}>{data.clientEmail}</Text>
          </View>
          <View style={intakeStyles.metaItem}>
            <Text style={intakeStyles.metaLabel}>Submitted</Text>
            <Text style={intakeStyles.metaValue}>
              {data.submittedAt ?? "Not submitted"}
            </Text>
          </View>
          <View style={intakeStyles.metaItem}>
            <Text style={intakeStyles.metaLabel}>Responses</Text>
            <Text style={intakeStyles.metaValue}>
              {data.responseCount} of {data.totalQuestions}
            </Text>
          </View>
        </View>

        {data.questions.map((question) => (
          <View key={`q-${question.questionNumber}`} style={intakeStyles.questionBlock}>
            <Text style={intakeStyles.questionKicker}>
              Question {question.questionNumber} of {data.totalQuestions}
            </Text>
            <Text style={intakeStyles.questionText}>{question.questionText}</Text>
            {question.answerLabel ? (
              <Text style={intakeStyles.answerLabel}>{question.answerLabel}</Text>
            ) : null}
            <Text style={intakeStyles.answerText}>{question.answerText}</Text>
            {question.advisorNote ? (
              <View style={intakeStyles.advisorNote}>
                <Text style={intakeStyles.advisorNoteLabel}>Advisor note</Text>
                <Text style={intakeStyles.advisorNoteText}>
                  {question.advisorNote}
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
